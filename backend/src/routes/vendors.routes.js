const express = require('express');
const path = require('path');
const fs = require('fs');
const { body, param, query: qv } = require('express-validator');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate, sanitizeString } = require('../middleware/validate.middleware');
const { parseMultipart } = require('../middleware/upload.middleware');
const svc = require('../services/vendor.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');
const { UPLOAD_DIR } = require('../middleware/upload.middleware');

const router = express.Router();

// ── Public: self-registration (no auth) ─────────────────────
// Requires tenantSlug in body to identify which tenant
router.post('/register',
  parseMultipart,
  async (req, res, next) => {
    try {
      const fields = req.uploadFields || req.body || {};
      const { tenantSlug, companyName, contactName, contactEmail, contactPhone,
              gstNumber, panNumber, website, productCategories, certifications } = fields;

      if (!tenantSlug) return errorResponse(res, 'tenantSlug is required', 400, 'MISSING_TENANT');
      if (!companyName || !contactName || !contactEmail)
        return errorResponse(res, 'companyName, contactName, contactEmail are required', 422, 'VALIDATION_ERROR');

      // Resolve tenantId from slug
      const { query } = require('../config/database');
      const tRes = await query('SELECT id FROM tenants WHERE slug=$1 AND status=\'active\' AND deleted_at IS NULL', [tenantSlug]);
      if (tRes.rows.length === 0) return errorResponse(res, 'Organisation not found', 404, 'TENANT_NOT_FOUND');
      const tenantId = tRes.rows[0].id;

      const cats = typeof productCategories === 'string'
        ? productCategories.split(',').map(s => s.trim()).filter(Boolean)
        : (productCategories || []);
      const certs = typeof certifications === 'string'
        ? certifications.split(',').map(s => s.trim()).filter(Boolean)
        : (certifications || []);

      const vendor = await svc.registerVendor(tenantId, {
        companyName, contactName, contactEmail, contactPhone,
        gstNumber, panNumber, website,
        productCategories: cats, certifications: certs,
      }, req.uploadedFiles || []);

      // Audit (no user — public action)
      const { log } = require('../services/audit.service');
      await log({ tenantId, action: 'vendor.self_registered', resourceType: 'vendor',
                  resourceId: vendor.id, newValues: { companyName, contactEmail }, ipAddress: req.ip });

      // Notify admins — fire-and-forget (don't block the response)
      const emailSvc = require('../services/email.service');
      const { query: dbQuery } = require('../config/database');
      dbQuery(
        `SELECT u.email, t.name AS tenant_name FROM users u
         JOIN tenants t ON t.id = u.tenant_id
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.tenant_id = $1 AND r.name = 'Super Admin' AND u.status = 'active' LIMIT 3`,
        [tenantId]
      ).then(({ rows }) => {
        rows.forEach(row => emailSvc.sendVendorRegistered({
          adminEmail: row.email, vendorName: companyName,
          vendorEmail: contactEmail, tenantName: row.tenant_name,
        }));
      }).catch(() => {});

      return successResponse(res, {
        id: vendor.id, status: vendor.status,
        message: 'Registration submitted. You will be notified once reviewed.',
      }, 201);
    } catch (err) {
      if (err.status) return errorResponse(res, err.message, err.status, err.code);
      next(err);
    }
  }
);

// ── All routes below require authentication ──────────────────
router.use(authenticate);

// GET /api/vendors
router.get('/', requirePermission('vendors', 'read'), async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { status, search } = req.query;
    const { rows, total } = await svc.getVendors(req.tenantId, { status, search, page, limit });
    return paginatedResponse(res, rows, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/vendors/stats
router.get('/stats', requirePermission('vendors', 'read'), async (req, res, next) => {
  try {
    const { query } = require('../config/database');
    const res2 = await query(
      `SELECT status, COUNT(*) as count FROM vendors WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status`,
      [req.tenantId]
    );
    const stats = { pending: 0, approved: 0, rejected: 0, changes_requested: 0, total: 0 };
    for (const row of res2.rows) { stats[row.status] = parseInt(row.count); stats.total += parseInt(row.count); }
    return successResponse(res, stats);
  } catch (err) { next(err); }
});

// GET /api/vendors/:id
router.get('/:id', requirePermission('vendors', 'read'),
  [param('id').isUUID()], validate,
  async (req, res, next) => {
    try {
      const vendor = await svc.getVendorById(req.tenantId, req.params.id);
      if (!vendor) return errorResponse(res, 'Vendor not found', 404);
      return successResponse(res, vendor);
    } catch (err) { next(err); }
  }
);

// PATCH /api/vendors/:id — update (by admin or vendor resubmitting after changes_requested)
router.patch('/:id', requirePermission('vendors', 'update'),
  [param('id').isUUID()], validate,
  async (req, res, next) => {
    try {
      const old = await svc.getVendorById(req.tenantId, req.params.id);
      const updated = await svc.updateVendor(req.tenantId, req.params.id, req.body);
      await audit.update(req, 'vendor', req.params.id, old, updated);
      return successResponse(res, updated);
    } catch (err) {
      if (err.status) return errorResponse(res, err.message, err.status, err.code);
      next(err);
    }
  }
);

// POST /api/vendors/:id/review — approve / reject / request_changes
router.post('/:id/review', requirePermission('vendors', 'approve'),
  [
    param('id').isUUID(),
    body('action').isIn(['approve', 'reject', 'request_changes']).withMessage('action must be approve|reject|request_changes'),
    body('reason').if(body('action').equals('reject')).notEmpty().withMessage('reason required for rejection'),
    body('note').if(body('action').equals('request_changes')).notEmpty().withMessage('note required for changes request'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { action, reason, note } = req.body;
      const old = await svc.getVendorById(req.tenantId, req.params.id);
      const updated = await svc.reviewVendor(req.tenantId, req.params.id, req.user.id, action, { reason, note });
      await audit.update(req, 'vendor', req.params.id, { status: old.status }, { status: updated.status, action });
      return successResponse(res, updated);
    } catch (err) {
      if (err.status) return errorResponse(res, err.message, err.status, err.code);
      next(err);
    }
  }
);

// DELETE /api/vendors/:id
router.delete('/:id', requirePermission('vendors', 'delete'),
  [param('id').isUUID()], validate,
  async (req, res, next) => {
    try {
      const old = await svc.getVendorById(req.tenantId, req.params.id);
      await svc.deleteVendor(req.tenantId, req.params.id);
      await audit.delete(req, 'vendor', req.params.id, old);
      return successResponse(res, { message: 'Vendor deleted' });
    } catch (err) {
      if (err.status) return errorResponse(res, err.message, err.status, err.code);
      next(err);
    }
  }
);

// GET /api/vendors/documents/:docId — secure file serving (tenant-scoped)
router.get('/documents/:docId', requirePermission('vendors', 'read'),
  [param('docId').isUUID()], validate,
  async (req, res, next) => {
    try {
      const doc = await svc.serveDocument(req.tenantId, req.params.docId);
      if (!doc) return errorResponse(res, 'Document not found', 404);
      const filePath = path.join(UPLOAD_DIR, doc.storage_path);
      if (!fs.existsSync(filePath)) return errorResponse(res, 'File not found on disk', 404);
      res.setHeader('Content-Type', doc.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) { next(err); }
  }
);

module.exports = router;
