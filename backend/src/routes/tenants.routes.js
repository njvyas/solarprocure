const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate, sanitizeString } = require('../middleware/validate.middleware');
const { query, withTransaction } = require('../config/database');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');
const { audit } = require('../services/audit.service');

const router = express.Router();
router.use(authenticate);

router.get('/current', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, slug, status, plan, settings, logo_url, address, gst_number, pan_number, created_at FROM tenants WHERE id = $1 AND deleted_at IS NULL',
      [req.tenantId]
    );
    if (result.rows.length === 0) return errorResponse(res, 'Tenant not found', 404);
    return successResponse(res, result.rows[0]);
  } catch (err) { next(err); }
});

router.patch('/current', requirePermission('tenants', 'update'),
  [
    body('name').optional().trim().isLength({ min: 2, max: 255 }).customSanitizer(sanitizeString),
    body('address').optional().isObject(),
    body('gstNumber').optional().matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).withMessage('Invalid GST format'),
    body('panNumber').optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Invalid PAN format'),
    body('settings').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const old = await query('SELECT * FROM tenants WHERE id = $1', [req.tenantId]);
      const { name, address, gstNumber, panNumber, settings } = req.body;
      const result = await query(
        `UPDATE tenants SET
           name = COALESCE($1, name), address = COALESCE($2, address),
           gst_number = COALESCE($3, gst_number), pan_number = COALESCE($4, pan_number),
           settings = CASE WHEN $5::jsonb IS NOT NULL THEN settings || $5::jsonb ELSE settings END,
           updated_at = NOW()
         WHERE id = $6 RETURNING id, name, slug, status, plan, settings, address, gst_number, pan_number`,
        [name||null, address?JSON.stringify(address):null, gstNumber||null, panNumber||null, settings?JSON.stringify(settings):null, req.tenantId]
      );
      await audit.update(req, 'tenant', req.tenantId, old.rows[0], result.rows[0]);
      return successResponse(res, result.rows[0]);
    } catch (err) { next(err); }
  }
);

router.get('/current/stats', requirePermission('tenants', 'read'), async (req, res, next) => {
  try {
    const [users, roles, logs] = await Promise.all([
      query("SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='active') active FROM users WHERE tenant_id=$1 AND deleted_at IS NULL", [req.tenantId]),
      query('SELECT COUNT(*) total FROM roles WHERE tenant_id=$1', [req.tenantId]),
      query("SELECT COUNT(*) total FROM audit_logs WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '30 days'", [req.tenantId]),
    ]);
    return successResponse(res, {
      users: { total: parseInt(users.rows[0].total), active: parseInt(users.rows[0].active) },
      roles: { total: parseInt(roles.rows[0].total) },
      recentAuditLogs: parseInt(logs.rows[0].total),
    });
  } catch (err) { next(err); }
});

router.get('/current/roles', requirePermission('roles', 'read'), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT r.id, r.name, r.description, r.is_system, r.permissions, r.created_at,
              COUNT(ur.user_id) as user_count
       FROM roles r LEFT JOIN user_roles ur ON ur.role_id = r.id AND ur.tenant_id = r.tenant_id
       WHERE r.tenant_id = $1 GROUP BY r.id ORDER BY r.is_system DESC, r.name ASC`,
      [req.tenantId]
    );
    return successResponse(res, result.rows);
  } catch (err) { next(err); }
});

router.post('/current/roles', requirePermission('roles', 'create'),
  [
    body('name').trim().notEmpty().isLength({ max: 100 }).customSanitizer(sanitizeString),
    body('description').optional().trim().isLength({ max: 500 }).customSanitizer(sanitizeString),
    body('permissions').isObject().withMessage('Permissions must be an object'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, permissions } = req.body;
      const result = await query(
        'INSERT INTO roles (tenant_id, name, description, permissions, is_system) VALUES ($1,$2,$3,$4,false) RETURNING *',
        [req.tenantId, name, description||null, JSON.stringify(permissions)]
      );
      await audit.create(req, 'role', result.rows[0].id, { name, permissions });
      return successResponse(res, result.rows[0], 201);
    } catch (err) { next(err); }
  }
);

router.patch('/current/roles/:id', requirePermission('roles', 'update'),
  [param('id').isUUID(), body('name').optional().trim(), body('permissions').optional().isObject()],
  validate,
  async (req, res, next) => {
    try {
      const existing = await query('SELECT * FROM roles WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId]);
      if (existing.rows.length === 0) return errorResponse(res, 'Role not found', 404);
      if (existing.rows[0].is_system) return errorResponse(res, 'System roles cannot be modified', 403, 'SYSTEM_ROLE');
      const { name, description, permissions } = req.body;
      const result = await query(
        `UPDATE roles SET name=COALESCE($1,name), description=COALESCE($2,description),
         permissions=COALESCE($3::jsonb,permissions), updated_at=NOW()
         WHERE id=$4 AND tenant_id=$5 RETURNING *`,
        [name||null, description||null, permissions?JSON.stringify(permissions):null, req.params.id, req.tenantId]
      );
      await audit.update(req, 'role', req.params.id, existing.rows[0], result.rows[0]);
      return successResponse(res, result.rows[0]);
    } catch (err) { next(err); }
  }
);

router.get('/current/audit-logs', requirePermission('audit', 'read'), async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { action, resource_type, user_id, status } = req.query;
    let where = 'WHERE tenant_id = $1';
    const params = [req.tenantId];
    let idx = 2;
    if (action) { where += ` AND action ILIKE $${idx++}`; params.push(`%${action}%`); }
    if (resource_type) { where += ` AND resource_type = $${idx++}`; params.push(resource_type); }
    if (user_id) { where += ` AND user_id = $${idx++}`; params.push(user_id); }
    if (status) { where += ` AND status = $${idx++}`; params.push(status); }
    const [count, rows] = await Promise.all([
      query(`SELECT COUNT(*) FROM audit_logs ${where}`, params),
      query(`SELECT id, user_id, user_email, action, resource_type, resource_id, metadata, ip_address, status, created_at FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]),
    ]);
    return paginatedResponse(res, rows.rows, parseInt(count.rows[0].count), page, limit);
  } catch (err) { next(err); }
});

module.exports = router;
