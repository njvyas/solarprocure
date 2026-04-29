const express = require('express');
const { param, body } = require('express-validator');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate, sanitizeString } = require('../middleware/validate.middleware');
const svc = require('../services/rfq.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

const router = express.Router();

// ── Public: vendor accesses RFQ via token ──────────────────
router.get('/token/:token', async (req, res, next) => {
  try {
    const data = await svc.getRfqByToken(req.params.token);
    if (!data) return errorResponse(res, 'Invalid or expired link', 404, 'INVALID_TOKEN');
    return successResponse(res, data);
  } catch (err) { next(err); }
});

// ── All routes below require auth ──────────────────────────
router.use(authenticate);

router.get('/stats', requirePermission('rfqs','read'), async (req,res,next) => {
  try {
    const { query } = require('../config/database');
    const r = await query(
      `SELECT status, COUNT(*) count FROM rfqs WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status`,
      [req.tenantId]
    );
    const stats = { draft:0,sent:0,open:0,closed:0,cancelled:0,awarded:0,total:0 };
    for (const row of r.rows) { stats[row.status]=parseInt(row.count); stats.total+=parseInt(row.count); }
    return successResponse(res, stats);
  } catch(err){next(err);}
});

router.get('/', requirePermission('rfqs','read'), async (req,res,next) => {
  try {
    const { page,limit } = parsePagination(req.query);
    const { rows,total } = await svc.getRfqs(req.tenantId, { status:req.query.status, search:req.query.search, page, limit });
    return paginatedResponse(res, rows, total, page, limit);
  } catch(err){next(err);}
});

router.get('/:id', requirePermission('rfqs','read'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const rfq = await svc.getRfqById(req.tenantId, req.params.id);
    if (!rfq) return errorResponse(res, 'RFQ not found', 404);
    return successResponse(res, rfq);
  } catch(err){next(err);}
});

router.post('/', requirePermission('rfqs','create'),
  [body('title').notEmpty().customSanitizer(sanitizeString),
   body('submissionDeadline').optional().isISO8601(),
   body('validityDays').optional().isInt({min:1}),
   body('items').optional().isArray()], validate,
  async (req,res,next) => {
    try {
      const rfq = await svc.createRfq(req.tenantId, req.user.id, req.body);
      await audit.create(req, 'rfq', rfq.id, { rfqNumber:rfq.rfq_number, title:rfq.title });
      return successResponse(res, rfq, 201);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.patch('/:id', requirePermission('rfqs','update'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const old = await svc.getRfqById(req.tenantId, req.params.id);
    const updated = await svc.updateRfq(req.tenantId, req.params.id, req.user.id, req.body);
    await audit.update(req,'rfq',req.params.id,old,updated);
    return successResponse(res, updated);
  } catch(err) {
    if(err.status) return errorResponse(res,err.message,err.status,err.code);
    next(err);
  }
});

// Import items from BOM
router.post('/:id/import-bom', requirePermission('rfqs','update'),
  [param('id').isUUID(), body('bomId').isUUID()], validate,
  async (req,res,next) => {
    try {
      const items = await svc.importItemsFromBom(req.tenantId, req.params.id, req.body.bomId);
      await audit.create(req,'rfq_import',req.params.id,{bomId:req.body.bomId,itemCount:items.length});
      return successResponse(res, { imported:items.length, items });
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// Manage vendors on RFQ
router.post('/:id/vendors', requirePermission('rfqs','update'),
  [param('id').isUUID(), body('vendorIds').isArray({min:1})], validate,
  async (req,res,next) => {
    try {
      const result = await svc.addVendors(req.tenantId, req.params.id, req.body.vendorIds);
      await audit.create(req,'rfq_vendors',req.params.id,{added:result.added});
      return successResponse(res, result);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.delete('/:id/vendors/:vendorId', requirePermission('rfqs','update'),
  [param('id').isUUID(), param('vendorId').isUUID()], validate,
  async (req,res,next) => {
    try {
      await svc.removeVendor(req.tenantId, req.params.id, req.params.vendorId);
      await audit.delete(req,'rfq_vendor',req.params.vendorId,{rfqId:req.params.id});
      return successResponse(res, { message:'Vendor removed from RFQ' });
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// Send RFQ to vendors
router.post('/:id/send', requirePermission('rfqs','send'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const rfq = await svc.sendRfq(req.tenantId, req.params.id, req.user.id);
      await audit.update(req,'rfq',req.params.id,{status:'draft'},{status:'sent'});

      // Send invite emails to all vendors on this RFQ — fire-and-forget
      const emailSvc = require('../services/email.service');
      const { query: dbQuery } = require('../config/database');
      const { name: tenantName } = (await dbQuery('SELECT name FROM tenants WHERE id=$1',[req.tenantId])).rows[0] || {};
      const deadline = rfq.submission_deadline ? new Date(rfq.submission_deadline).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : 'See RFQ details';
      (rfq.vendors || []).forEach(v => {
        if (v.contact_email && v.bid_token) {
          emailSvc.sendRfqInvite({
            vendorEmail: v.contact_email, vendorName: v.company_name,
            rfqTitle: rfq.title, rfqId: rfq.id,
            bidToken: v.bid_token, deadline, tenantName: tenantName || 'Procurement Team',
          }).catch(() => {});
        }
      });

      return successResponse(res, rfq);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// Close RFQ
router.post('/:id/close', requirePermission('rfqs','update'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const rfq = await svc.closeRfq(req.tenantId, req.params.id, req.user.id);
      await audit.update(req,'rfq',req.params.id,{},{status:'closed'});
      return successResponse(res, rfq);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// Cancel RFQ
router.post('/:id/cancel', requirePermission('rfqs','update'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const rfq = await svc.cancelRfq(req.tenantId, req.params.id, req.user.id);
      await audit.update(req,'rfq',req.params.id,{},{status:'cancelled'});
      return successResponse(res, rfq);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// Delete draft RFQ
router.delete('/:id', requirePermission('rfqs','delete'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      await svc.deleteRfq(req.tenantId, req.params.id);
      await audit.delete(req,'rfq',req.params.id,{});
      return successResponse(res, { message:'RFQ deleted' });
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

module.exports = router;
