const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const svc = require('../services/reports.service');
const { successResponse, errorResponse } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard',     requirePermission('reports','read'), async (req,res,next) => {
  try { return successResponse(res, await svc.getDashboardKpis(req.tenantId, req.query)); } catch(e){next(e);}
});
router.get('/vendors',       requirePermission('reports','read'), async (req,res,next) => {
  try { return successResponse(res, await svc.getVendorReport(req.tenantId, req.query)); } catch(e){next(e);}
});
router.get('/rfqs',          requirePermission('reports','read'), async (req,res,next) => {
  try { return successResponse(res, await svc.getRfqReport(req.tenantId, req.query)); } catch(e){next(e);}
});
router.get('/spend',         requirePermission('reports','read'), async (req,res,next) => {
  try { return successResponse(res, await svc.getSpendReport(req.tenantId, req.query)); } catch(e){next(e);}
});
router.get('/audit-summary', requirePermission('reports','read'), async (req,res,next) => {
  try { return successResponse(res, await svc.getAuditSummary(req.tenantId, req.query)); } catch(e){next(e);}
});

module.exports = router;
