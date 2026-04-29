const express = require('express');
const { param, body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate } = require('../middleware/validate.middleware');
const svc = require('../services/vendor_mgmt.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

// ── Compliance CRUD ─────────────────────────────────────────
router.get('/:vendorId/compliance', requirePermission('vendors','read'),
  [param('vendorId').isUUID()], validate,
  async (req, res, next) => {
    try {
      const rows = await svc.getCompliance(req.tenantId, req.params.vendorId);
      return successResponse(res, rows);
    } catch (err) { next(err); }
  }
);

router.post('/:vendorId/compliance', requirePermission('vendors','update'),
  [param('vendorId').isUUID(), body('certName').notEmpty()], validate,
  async (req, res, next) => {
    try {
      const row = await svc.upsertCompliance(req.tenantId, req.params.vendorId, req.body);
      await audit.create(req, 'vendor_compliance', row.id, { certName: req.body.certName });
      return successResponse(res, row, 201);
    } catch (err) { next(err); }
  }
);

router.put('/:vendorId/compliance/:certId', requirePermission('vendors','update'),
  [param('vendorId').isUUID(), param('certId').isUUID(), body('certName').notEmpty()], validate,
  async (req, res, next) => {
    try {
      const row = await svc.upsertCompliance(req.tenantId, req.params.vendorId, { ...req.body, id: req.params.certId });
      await audit.update(req, 'vendor_compliance', req.params.certId, null, row);
      return successResponse(res, row);
    } catch (err) { next(err); }
  }
);

router.delete('/:vendorId/compliance/:certId', requirePermission('vendors','update'),
  [param('vendorId').isUUID(), param('certId').isUUID()], validate,
  async (req, res, next) => {
    try {
      await svc.deleteCompliance(req.tenantId, req.params.certId);
      await audit.delete(req, 'vendor_compliance', req.params.certId, {});
      return successResponse(res, { message: 'Deleted' });
    } catch (err) {
      if (err.status) return errorResponse(res, err.message, err.status);
      next(err);
    }
  }
);

// ── Performance ─────────────────────────────────────────────
router.get('/:vendorId/performance', requirePermission('vendors','read'),
  [param('vendorId').isUUID()], validate,
  async (req, res, next) => {
    try {
      const rows = await svc.getPerformance(req.tenantId, req.params.vendorId);
      return successResponse(res, rows);
    } catch (err) { next(err); }
  }
);

router.post('/:vendorId/performance', requirePermission('vendors','update'),
  [param('vendorId').isUUID(),
   body('periodYear').isInt({ min:2000, max:2100 }),
   body('periodQuarter').optional().isInt({ min:1, max:4 })], validate,
  async (req, res, next) => {
    try {
      const row = await svc.upsertPerformance(req.tenantId, req.params.vendorId, req.user.id, req.body);
      await audit.create(req, 'vendor_performance', row.id, { periodYear: req.body.periodYear });
      return successResponse(res, row, 201);
    } catch (err) { next(err); }
  }
);

// ── Expiry alerts ───────────────────────────────────────────
router.get('/compliance/expiring', requirePermission('vendors','read'),
  async (req, res, next) => {
    try {
      const days = parseInt(req.query.days) || 90;
      const rows = await svc.getExpiringCerts(req.tenantId, days);
      return successResponse(res, rows);
    } catch (err) { next(err); }
  }
);

module.exports = router;
