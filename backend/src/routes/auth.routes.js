const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { loginUser, refreshAccessToken, logoutUser } = require('../services/auth.service');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, sanitizeString } = require('../middleware/validate.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const { query } = require('../config/database');

const router = express.Router();

// Strict rate limit on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.', code: 'RATE_LIMIT_EXCEEDED' },
  keyGenerator: (req) => `login:${req.ip}:${req.body?.email || 'unknown'}`,
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many refresh attempts', code: 'RATE_LIMIT_EXCEEDED' },
});

// ============================================================
// POST /api/auth/login
// ============================================================
router.post(
  '/login',
  loginLimiter,
  [
    body('email')
      .isEmail().withMessage('Valid email required')
      .normalizeEmail()
      .customSanitizer(sanitizeString),
    body('password')
      .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters'),
    body('tenantSlug')
      .notEmpty().withMessage('Tenant identifier required')
      .isSlug().withMessage('Invalid tenant identifier')
      .customSanitizer(sanitizeString),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password, tenantSlug } = req.body;
      const result = await loginUser(email, password, tenantSlug, req);
      return successResponse(res, result, 200);
    } catch (err) {
      if (err.status) {
        return errorResponse(res, err.message, err.status, err.code);
      }
      next(err);
    }
  }
);

// ============================================================
// POST /api/auth/refresh
// ============================================================
router.post(
  '/refresh',
  refreshLimiter,
  [
    body('refreshToken').notEmpty().withMessage('Refresh token required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await refreshAccessToken(req.body.refreshToken, req);
      return successResponse(res, result, 200);
    } catch (err) {
      if (err.status) {
        return errorResponse(res, err.message, err.status, err.code);
      }
      next(err);
    }
  }
);

// ============================================================
// POST /api/auth/logout
// ============================================================
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await logoutUser(req);
    return successResponse(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/auth/me
// ============================================================
router.get('/me', authenticate, async (req, res, next) => {
  try {
    // Load fresh profile
    const result = await query(
      `SELECT id, tenant_id, email, first_name, last_name, phone, 
              avatar_url, status, email_verified, last_login_at, created_at
       FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [req.user.id, req.tenantId]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 'User not found', 404);
    }

    const user = result.rows[0];
    return successResponse(res, {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      status: user.status,
      emailVerified: user.email_verified,
      lastLoginAt: user.last_login_at,
      tenantId: req.tenantId,
      tenantName: req.tenant.name,
      roles: req.roles,
      permissions: req.permissions,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/auth/change-password
// ============================================================
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const bcrypt = require('bcryptjs');
      const { query: dbQuery } = require('../config/database');

      const userResult = await dbQuery(
        'SELECT password_hash FROM users WHERE id = $1 AND tenant_id = $2',
        [req.user.id, req.tenantId]
      );

      const valid = await bcrypt.compare(req.body.currentPassword, userResult.rows[0].password_hash);
      if (!valid) {
        return errorResponse(res, 'Current password is incorrect', 400, 'WRONG_PASSWORD');
      }

      const newHash = await bcrypt.hash(req.body.newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
      await dbQuery(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
        [newHash, req.user.id, req.tenantId]
      );

      const { audit } = require('../services/audit.service');
      await audit.update(req, 'user', req.user.id, null, { passwordChanged: true });

      return successResponse(res, { message: 'Password changed successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// PATCH /api/auth/me — self-service profile update (no special permission needed)
// Users can update their own first_name, last_name, phone
// ============================================================
router.patch(
  '/me',
  authenticate,
  [
    body('firstName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('First name too long'),
    body('lastName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Last name too long'),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }).withMessage('Phone too long'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { firstName, lastName, phone } = req.body;
      const { query: dbQuery } = require('../config/database');
      const { audit } = require('../services/audit.service');

      const old = await dbQuery(
        'SELECT first_name, last_name, phone FROM users WHERE id = $1 AND tenant_id = $2',
        [req.user.id, req.tenantId]
      );

      const result = await dbQuery(
        `UPDATE users SET
           first_name  = COALESCE($1, first_name),
           last_name   = COALESCE($2, last_name),
           phone       = COALESCE($3, phone),
           updated_at  = NOW()
         WHERE id = $4 AND tenant_id = $5
         RETURNING id, email, first_name, last_name, phone, updated_at`,
        [firstName || null, lastName || null, phone !== undefined ? (phone || null) : null, req.user.id, req.tenantId]
      );

      await audit.update(req, 'user', req.user.id, old.rows[0], result.rows[0]);

      return successResponse(res, {
        id:        result.rows[0].id,
        email:     result.rows[0].email,
        firstName: result.rows[0].first_name,
        lastName:  result.rows[0].last_name,
        phone:     result.rows[0].phone,
        updatedAt: result.rows[0].updated_at,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
