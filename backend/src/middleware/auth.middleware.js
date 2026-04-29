const { verifyAccessToken, secondsUntilExpiry } = require('../utils/jwt');
const { isTokenBlacklisted } = require('../config/redis');
const { query } = require('../config/database');
const { mergePermissions } = require('../utils/rbac');
const { errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * authenticate middleware
 *
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies JWT signature + expiry
 * 3. Checks token blacklist (logout/revocation)
 * 4. Loads user from DB → verifies tenant membership
 * 5. Loads roles → merges permissions
 * 6. Attaches to req: user, tenantId, permissions
 *
 * CRITICAL: tenantId is ALWAYS taken from the validated JWT (tid claim),
 * NOT from request params. This prevents cross-tenant attacks.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authorization header missing or malformed', 401, 'AUTH_MISSING');
    }

    const token = authHeader.substring(7);

    // Verify signature
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Token has expired', 401, 'TOKEN_EXPIRED');
      }
      return errorResponse(res, 'Invalid token', 401, 'TOKEN_INVALID');
    }

    if (decoded.type !== 'access') {
      return errorResponse(res, 'Invalid token type', 401, 'TOKEN_TYPE_INVALID');
    }

    // Check blacklist
    const blacklisted = await isTokenBlacklisted(decoded.jti);
    if (blacklisted) {
      return errorResponse(res, 'Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    // Load user from DB (fresh on every request - always current data)
    const userResult = await query(
      `SELECT u.id, u.tenant_id, u.email, u.first_name, u.last_name, 
              u.status, u.email_verified, u.avatar_url
       FROM users u
       WHERE u.id = $1 
         AND u.tenant_id = $2 
         AND u.deleted_at IS NULL`,
      [decoded.sub, decoded.tid]
    );

    if (userResult.rows.length === 0) {
      return errorResponse(res, 'User not found or access revoked', 401, 'USER_NOT_FOUND');
    }

    const user = userResult.rows[0];

    if (user.status === 'locked') {
      return errorResponse(res, 'Account is locked. Contact your administrator.', 403, 'ACCOUNT_LOCKED');
    }

    if (user.status === 'inactive') {
      return errorResponse(res, 'Account is inactive', 403, 'ACCOUNT_INACTIVE');
    }

    // Verify tenant is still active
    const tenantResult = await query(
      `SELECT id, status, name FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
      [decoded.tid]
    );

    if (tenantResult.rows.length === 0 || tenantResult.rows[0].status === 'suspended') {
      return errorResponse(res, 'Tenant suspended or not found', 403, 'TENANT_SUSPENDED');
    }

    // Load roles + permissions
    const rolesResult = await query(
      `SELECT r.id, r.name, r.permissions
       FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1
         AND ur.tenant_id = $2
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
      [user.id, user.tenant_id]
    );

    const roles = rolesResult.rows;
    const permissions = mergePermissions(roles);

    // Attach everything to request
    req.user = user;
    req.tenantId = user.tenant_id; // ALWAYS from DB, not from user input
    req.tenant = tenantResult.rows[0];
    req.roles = roles.map((r) => ({ id: r.id, name: r.name }));
    req.permissions = permissions;
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;

    next();
  } catch (err) {
    logger.error('Authentication middleware error', { error: err.message, stack: err.stack });
    return errorResponse(res, 'Authentication failed', 500, 'AUTH_ERROR');
  }
}

/**
 * Optional auth - sets req.user if token provided, but doesn't fail if absent
 * Used for endpoints accessible by both authenticated and anonymous users
 */
async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authenticate(req, res, next);
}

/**
 * Tenant context middleware for multi-tenant aware routes
 * Validates that the tenantId in the URL matches the authenticated user's tenant
 */
function requireTenantMatch(req, res, next) {
  const urlTenantId = req.params.tenantId;
  if (urlTenantId && urlTenantId !== req.tenantId) {
    return errorResponse(res, 'Cross-tenant access denied', 403, 'CROSS_TENANT_DENIED');
  }
  next();
}

module.exports = { authenticate, optionalAuthenticate, requireTenantMatch };
