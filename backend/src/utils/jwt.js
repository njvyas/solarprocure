const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate access + refresh token pair
 * Payload is MINIMAL - only IDs. No roles/permissions in token.
 * Roles are fetched fresh from DB on each request (via middleware).
 */
function generateTokenPair(user, tenantId) {
  const jti = crypto.randomUUID(); // unique token ID for revocation

  const accessToken = jwt.sign(
    {
      jti,
      sub: user.id,
      tid: tenantId,  // tenant_id
      email: user.email,
      type: 'access',
    },
    ACCESS_SECRET,
    {
      expiresIn: ACCESS_EXPIRES,
      issuer: 'eprocure',
      audience: 'eprocure-api',
    }
  );

  const refreshToken = jwt.sign(
    {
      jti,
      sub: user.id,
      tid: tenantId,
      type: 'refresh',
    },
    REFRESH_SECRET,
    {
      expiresIn: REFRESH_EXPIRES,
      issuer: 'eprocure',
      audience: 'eprocure-api',
    }
  );

  return { accessToken, refreshToken, jti };
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, {
    issuer: 'eprocure',
    audience: 'eprocure-api',
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET, {
    issuer: 'eprocure',
    audience: 'eprocure-api',
  });
}

function decodeToken(token) {
  return jwt.decode(token);
}

// Convert JWT exp claim to seconds until expiry
function secondsUntilExpiry(decodedToken) {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, decodedToken.exp - now);
}

module.exports = {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  secondsUntilExpiry,
};
