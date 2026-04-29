const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/database');
const { blacklistToken, isTokenBlacklisted } = require('../config/redis');
const { generateTokenPair, verifyRefreshToken, decodeToken, secondsUntilExpiry } = require('../utils/jwt');
const { mergePermissions } = require('../utils/rbac');
const { audit } = require('./audit.service');
const logger = require('../utils/logger');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

async function loginUser(email, password, tenantSlug, req) {
  // 1. Find tenant by slug
  const tenantResult = await query(
    `SELECT id, name, status FROM tenants WHERE slug = $1 AND deleted_at IS NULL`,
    [tenantSlug]
  );

  if (tenantResult.rows.length === 0) {
    await audit.loginFailed(req, email, null);
    throw Object.assign(new Error('Invalid credentials'), { status: 401, code: 'INVALID_CREDENTIALS' });
  }

  const tenant = tenantResult.rows[0];

  if (tenant.status === 'suspended') {
    throw Object.assign(new Error('Account suspended'), { status: 403, code: 'TENANT_SUSPENDED' });
  }

  // 2. Find user within tenant
  const userResult = await query(
    `SELECT id, tenant_id, email, password_hash, first_name, last_name,
            status, email_verified, failed_login_count, locked_until
     FROM users
     WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [email.toLowerCase().trim(), tenant.id]
  );

  if (userResult.rows.length === 0) {
    // Don't reveal user existence - same error
    await audit.loginFailed(req, email, tenant.id);
    throw Object.assign(new Error('Invalid credentials'), { status: 401, code: 'INVALID_CREDENTIALS' });
  }

  const user = userResult.rows[0];

  // 3. Check account lock
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await audit.loginFailed(req, email, tenant.id);
    throw Object.assign(
      new Error(`Account locked until ${new Date(user.locked_until).toISOString()}`),
      { status: 403, code: 'ACCOUNT_LOCKED' }
    );
  }

  // 4. Check status
  if (user.status !== 'active') {
    throw Object.assign(new Error('Account is not active'), { status: 403, code: `ACCOUNT_${user.status.toUpperCase()}` });
  }

  // 5. Verify password
  const passwordValid = await bcrypt.compare(password, user.password_hash);

  if (!passwordValid) {
    const newFailCount = user.failed_login_count + 1;
    const shouldLock = newFailCount >= MAX_FAILED_ATTEMPTS;

    await query(
      `UPDATE users SET
         failed_login_count = $1,
         locked_until = $2,
         updated_at = NOW()
       WHERE id = $3`,
      [
        newFailCount,
        shouldLock
          ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60000).toISOString()
          : null,
        user.id,
      ]
    );

    await audit.loginFailed(req, email, tenant.id);
    throw Object.assign(new Error('Invalid credentials'), { status: 401, code: 'INVALID_CREDENTIALS' });
  }

  // 6. Generate token pair
  const { accessToken, refreshToken, jti } = generateTokenPair(user, tenant.id);

  // 7. Store refresh token hash in DB
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await withTransaction(async (client) => {
    // Store refresh token
    await client.query(
      `INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenant.id, user.id, tokenHash, req.headers['user-agent'], req.ip, refreshExpiry]
    );

    // Reset failed login count + update last login
    await client.query(
      `UPDATE users SET
         failed_login_count = 0,
         locked_until = NULL,
         last_login_at = NOW(),
         last_login_ip = $1,
         updated_at = NOW()
       WHERE id = $2`,
      [req.ip, user.id]
    );
  });

  // 8. Load roles for response (not stored in token)
  const rolesResult = await query(
    `SELECT r.id, r.name, r.permissions
     FROM roles r
     INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1 AND ur.tenant_id = $2
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
    [user.id, tenant.id]
  );

  await audit.loginSuccess(req, user);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      tenantId: tenant.id,
      tenantName: tenant.name,
      roles: rolesResult.rows.map((r) => r.name),
      permissions: mergePermissions(rolesResult.rows),
    },
  };
}

async function refreshAccessToken(refreshToken, req) {
  // 1. Verify signature
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401, code: 'REFRESH_TOKEN_INVALID' });
  }

  if (decoded.type !== 'refresh') {
    throw Object.assign(new Error('Invalid token type'), { status: 401, code: 'TOKEN_TYPE_INVALID' });
  }

  // 2. Check blacklist
  if (await isTokenBlacklisted(decoded.jti)) {
    throw Object.assign(new Error('Refresh token revoked'), { status: 401, code: 'REFRESH_TOKEN_REVOKED' });
  }

  // 3. Verify token hash in DB
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const tokenResult = await query(
    `SELECT id FROM refresh_tokens
     WHERE token_hash = $1
       AND user_id = $2
       AND tenant_id = $3
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [tokenHash, decoded.sub, decoded.tid]
  );

  if (tokenResult.rows.length === 0) {
    throw Object.assign(new Error('Refresh token not found or expired'), { status: 401, code: 'REFRESH_TOKEN_INVALID' });
  }

  // 4. Load user
  const userResult = await query(
    `SELECT id, tenant_id, email, first_name, last_name, status
     FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [decoded.sub, decoded.tid]
  );

  if (userResult.rows.length === 0 || userResult.rows[0].status !== 'active') {
    throw Object.assign(new Error('User not available'), { status: 401, code: 'USER_NOT_AVAILABLE' });
  }

  const user = userResult.rows[0];

  // 5. Rotate: revoke old, issue new pair
  const { accessToken, refreshToken: newRefreshToken, jti: newJti } = generateTokenPair(user, decoded.tid);
  const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

  await withTransaction(async (client) => {
    // Revoke old refresh token
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash]
    );
    // Blacklist old JTI (access token)
    await blacklistToken(decoded.jti, 900); // 15 min

    // Store new refresh token
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [decoded.tid, user.id, newTokenHash, req.headers['user-agent'], req.ip, refreshExpiry]
    );
  });

  await audit.tokenRefreshed(req, user.id);

  return { accessToken, refreshToken: newRefreshToken };
}

async function logoutUser(req) {
  const { tokenJti, tokenExp } = req;

  // Blacklist current access token
  if (tokenJti) {
    const remaining = tokenExp - Math.floor(Date.now() / 1000);
    await blacklistToken(tokenJti, Math.max(remaining, 0));
  }

  // Revoke all refresh tokens for this user (logout all devices)
  const logoutAll = req.body?.logoutAll === true;
  if (logoutAll) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,
      [req.user.id, req.tenantId]
    );
  }

  await audit.logout(req);
}

module.exports = { loginUser, refreshAccessToken, logoutUser };
