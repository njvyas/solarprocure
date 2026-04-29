const express = require('express');
const { param, body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate } = require('../middleware/validate.middleware');
const svc = require('../services/quote.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

const router = express.Router();

// ── Public: vendor submits quote via token ─────────────────
router.post('/submit/:token',
  [body('currency').optional().isLength({min:3,max:3}),
   body('validityDays').optional().isInt({min:1}),
   body('items').optional().isArray()], validate,
  async (req,res,next) => {
    try {
      const quote = await svc.submitQuoteByToken(req.params.token, req.body);
      return successResponse(res, { id:quote.id, quoteNumber:quote.quote_number, status:quote.status, totalAmount:quote.total_amount });
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// ── Auth required below ────────────────────────────────────
router.use(authenticate);

router.get('/', requirePermission('quotes','read'), async (req,res,next) => {
  try {
    const { page,limit } = parsePagination(req.query);
    const { rfqId, vendorId, status } = req.query;
    const { rows,total } = await svc.getQuotes(req.tenantId, { rfqId,vendorId,status,page,limit });
    return paginatedResponse(res, rows, total, page, limit);
  } catch(err){next(err);}
});

router.get('/compare/:rfqId', requirePermission('quotes','read'),
  [param('rfqId').isUUID()], validate,
  async (req,res,next) => {
    try {
      const matrix = await svc.getComparisonMatrix(req.tenantId, req.params.rfqId);
      return successResponse(res, matrix);
    } catch(err){next(err);}
  }
);

router.get('/:id', requirePermission('quotes','read'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const quote = await svc.getQuoteById(req.tenantId, req.params.id);
    if (!quote) return errorResponse(res,'Quote not found',404);
    return successResponse(res, quote);
  } catch(err){next(err);}
});

router.post('/:id/evaluate', requirePermission('quotes','evaluate'),
  [param('id').isUUID(),
   body('status').isIn(['shortlisted','rejected','awarded']),
   body('evaluationNotes').optional().isString()], validate,
  async (req,res,next) => {
    try {
      const old = await svc.getQuoteById(req.tenantId, req.params.id);
      const updated = await svc.evaluateQuote(req.tenantId, req.params.id, req.user.id, req.body);
      await audit.update(req,'quote',req.params.id,{status:old?.status},{status:updated.status});
      return successResponse(res, updated);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.post('/:id/withdraw', requirePermission('quotes','update'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const updated = await svc.withdrawQuote(req.tenantId, req.params.id);
      await audit.update(req,'quote',req.params.id,{},{status:'withdrawn'});
      return successResponse(res, updated);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

module.exports = router;
