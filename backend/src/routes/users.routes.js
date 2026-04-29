const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query: queryParam } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate, sanitizeString } = require('../middleware/validate.middleware');
const { query, withTransaction } = require('../config/database');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');
const { audit } = require('../services/audit.service');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// ============================================================
// GET /api/users — list users (tenant-scoped)
// ============================================================
router.get(
  '/',
  requirePermission('users', 'read'),
  async (req, res, next) => {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { status, search } = req.query;

      let whereClause = 'WHERE u.tenant_id = $1 AND u.deleted_at IS NULL';
      const params = [req.tenantId];
      let paramIdx = 2;

      if (status) {
        whereClause += ` AND u.status = $${paramIdx++}`;
        params.push(status);
      }

      if (search) {
        whereClause += ` AND (u.email ILIKE $${paramIdx} OR u.first_name ILIKE $${paramIdx} OR u.last_name ILIKE $${paramIdx})`;
        params.push(`%${search}%`);
        paramIdx++;
      }

      const countResult = await query(
        `SELECT COUNT(*) FROM users u ${whereClause}`,
        params
      );

      const usersResult = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
                u.status, u.email_verified, u.last_login_at, u.created_at,
                COALESCE(
                  JSON_AGG(
                    JSON_BUILD_OBJECT('id', r.id, 'name', r.name)
                    ORDER BY r.name
                  ) FILTER (WHERE r.id IS NOT NULL),
                  '[]'
                ) as roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
           AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
         LEFT JOIN roles r ON r.id = ur.role_id
         ${whereClause}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      );

      return paginatedResponse(res, usersResult.rows, parseInt(countResult.rows[0].count), page, limit);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// GET /api/users/:id
// ============================================================
router.get(
  '/:id',
  requirePermission('users', 'read'),
  [param('id').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
                u.status, u.email_verified, u.last_login_at, u.created_at,
                COALESCE(
                  JSON_AGG(JSON_BUILD_OBJECT('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL),
                  '[]'
                ) as roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = $1 AND u.tenant_id = $2 AND u.deleted_at IS NULL
         GROUP BY u.id`,
        [req.params.id, req.tenantId]
      );

      if (result.rows.length === 0) {
        return errorResponse(res, 'User not found', 404, 'NOT_FOUND');
      }

      return successResponse(res, result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// POST /api/users — create user
// ============================================================
router.post(
  '/',
  requirePermission('users', 'create'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8, max: 128 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('firstName').notEmpty().trim().isLength({ max: 100 }).customSanitizer(sanitizeString),
    body('lastName').notEmpty().trim().isLength({ max: 100 }).customSanitizer(sanitizeString),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('roleIds').optional().isArray(),
    body('roleIds.*').optional().isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password, firstName, lastName, phone, roleIds = [] } = req.body;

      // Check duplicate within tenant
      const existing = await query(
        'SELECT id FROM users WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [email, req.tenantId]
      );
      if (existing.rows.length > 0) {
        return errorResponse(res, 'User with this email already exists', 409, 'DUPLICATE_EMAIL');
      }

      const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      const newUser = await withTransaction(async (client) => {
        const userResult = await client.query(
          `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, status, email_verified)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', true)
           RETURNING id, email, first_name, last_name, status, created_at`,
          [req.tenantId, email, passwordHash, firstName, lastName, phone || null]
        );

        const user = userResult.rows[0];

        // Assign roles (validate they belong to same tenant)
        if (roleIds.length > 0) {
          const validRoles = await client.query(
            `SELECT id FROM roles WHERE id = ANY($1) AND tenant_id = $2`,
            [roleIds, req.tenantId]
          );

          for (const role of validRoles.rows) {
            await client.query(
              `INSERT INTO user_roles (tenant_id, user_id, role_id, granted_by) VALUES ($1, $2, $3, $4)
               ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING`,
              [req.tenantId, user.id, role.id, req.user.id]
            );
          }
        }

        return user;
      });

      await audit.create(req, 'user', newUser.id, { email, firstName, lastName });

      return successResponse(res, newUser, 201);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// PATCH /api/users/:id — update user
// ============================================================
router.patch(
  '/:id',
  requirePermission('users', 'update'),
  [
    param('id').isUUID(),
    body('firstName').optional().trim().isLength({ max: 100 }).customSanitizer(sanitizeString),
    body('lastName').optional().trim().isLength({ max: 100 }).customSanitizer(sanitizeString),
    body('phone').optional().isMobilePhone(),
    body('status').optional().isIn(['active', 'inactive']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existing = await query(
        'SELECT * FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.tenantId]
      );

      if (existing.rows.length === 0) {
        return errorResponse(res, 'User not found', 404);
      }

      const old = existing.rows[0];
      const { firstName, lastName, phone, status } = req.body;

      const result = await query(
        `UPDATE users SET
           first_name = COALESCE($1, first_name),
           last_name  = COALESCE($2, last_name),
           phone      = COALESCE($3, phone),
           status     = COALESCE($4, status),
           updated_at = NOW()
         WHERE id = $5 AND tenant_id = $6
         RETURNING id, email, first_name, last_name, phone, status, updated_at`,
        [firstName || null, lastName || null, phone || null, status || null, req.params.id, req.tenantId]
      );

      await audit.update(req, 'user', req.params.id, old, result.rows[0]);

      return successResponse(res, result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// DELETE /api/users/:id — soft delete
// ============================================================
router.delete(
  '/:id',
  requirePermission('users', 'delete'),
  [param('id').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      // Prevent self-deletion
      if (req.params.id === req.user.id) {
        return errorResponse(res, 'Cannot delete your own account', 400, 'SELF_DELETE');
      }

      const result = await query(
        `UPDATE users SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         RETURNING id, email`,
        [req.params.id, req.tenantId]
      );

      if (result.rows.length === 0) {
        return errorResponse(res, 'User not found', 404);
      }

      await audit.delete(req, 'user', req.params.id, result.rows[0]);

      return successResponse(res, { message: 'User deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// GET /api/users/roles/list — list available roles for tenant
// ============================================================
router.get(
  '/roles/list',
  requirePermission('users', 'read'),
  async (req, res, next) => {
    try {
      const result = await query(
        'SELECT id, name, description, is_system, permissions FROM roles WHERE tenant_id = $1 ORDER BY name',
        [req.tenantId]
      );
      return successResponse(res, result.rows);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
