const express = require('express');
const { param, body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate } = require('../middleware/validate.middleware');
const svc = require('../services/ai.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

// ── Provider management (admin only) ────────────────────────
router.get('/providers', requirePermission('ai','read'), async (req,res,next) => {
  try { return successResponse(res, await svc.listProviders(req.tenantId)); }
  catch(err){next(err);}
});

router.post('/providers', requirePermission('ai','manage'),
  [body('provider').isIn(['anthropic','openai','gemini','cohere','mistral','custom']),
   body('name').notEmpty().trim(),
   body('apiKey').notEmpty().isLength({min:10}),
   body('model').optional().trim(),
   body('baseUrl').optional().isURL(),
   body('isDefault').optional().isBoolean()], validate,
  async (req,res,next) => {
    try {
      const p = await svc.addProvider(req.tenantId, req.user.id, req.body);
      await audit.create(req, 'ai_provider', p.id, { provider:req.body.provider, name:req.body.name });
      return successResponse(res, p, 201);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.patch('/providers/:id', requirePermission('ai','manage'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const p = await svc.updateProvider(req.tenantId, req.params.id, req.body);
      await audit.update(req,'ai_provider',req.params.id,{},{name:p.name,isActive:p.is_active});
      return successResponse(res, p);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.delete('/providers/:id', requirePermission('ai','manage'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      await svc.deleteProvider(req.tenantId, req.params.id);
      await audit.delete(req,'ai_provider',req.params.id,{});
      return successResponse(res, { message:'Provider deleted' });
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.post('/providers/:id/test', requirePermission('ai','manage'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try { return successResponse(res, await svc.testProvider(req.tenantId, req.params.id)); }
    catch(err){ if(err.status) return errorResponse(res,err.message,err.status); next(err); }
  }
);

// ── Insights ─────────────────────────────────────────────────
router.get('/insights', requirePermission('ai','read'), async (req,res,next) => {
  try {
    const { page,limit } = parsePagination(req.query);
    const result = await svc.getInsights(req.tenantId, {
      insightType: req.query.type, status: req.query.status, page, limit
    });
    return paginatedResponse(res, result.rows, result.total, page, limit);
  } catch(err){next(err);}
});

router.get('/insights/:id', requirePermission('ai','read'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const ins = await svc.getInsightById(req.tenantId, req.params.id);
      if (!ins) return errorResponse(res,'Insight not found',404);
      return successResponse(res, ins);
    } catch(err){next(err);}
  }
);

router.post('/insights', requirePermission('ai','use'),
  [body('insightType').isIn(['spend_forecast','vendor_risk','rfq_optimization',
    'price_benchmark','po_anomaly','vendor_recommendation','savings_opportunity','compliance_risk']),
   body('providerId').optional().isUUID()], validate,
  async (req,res,next) => {
    try {
      const job = await svc.runInsight(req.tenantId, req.user.id, req.body.insightType, req.body.providerId);
      await audit.create(req,'ai_insight',job.id,{type:req.body.insightType});
      return successResponse(res, job, 202);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// GET /api/ai/context — returns current procurement context for preview
router.get('/context', requirePermission('ai','read'), async (req,res,next) => {
  try {
    const ctx = await svc.buildProcurementContext(req.tenantId);
    // Don't expose raw context in prod — sanitize
    return successResponse(res, {
      vendorCount: ctx.topVendors.length,
      rfqCount: ctx.recentRfqs.length,
      spendMonths: ctx.spendTrend.length,
      pendingPos: ctx.pendingPos,
      kpis: ctx.kpis,
    });
  } catch(err){next(err);}
});

// ── Chat ─────────────────────────────────────────────────────
router.get('/chat', requirePermission('ai','use'), async (req,res,next) => {
  try { return successResponse(res, await svc.getChatSessions(req.tenantId, req.user.id)); }
  catch(err){next(err);}
});

router.get('/chat/:id', requirePermission('ai','use'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const sess = await svc.getChatSession(req.tenantId, req.params.id, req.user.id);
      if (!sess) return errorResponse(res,'Session not found',404);
      return successResponse(res, sess);
    } catch(err){next(err);}
  }
);

router.post('/chat', requirePermission('ai','use'),
  [body('message').notEmpty().isLength({max:2000}),
   body('sessionId').optional().isUUID(),
   body('providerId').optional().isUUID()], validate,
  async (req,res,next) => {
    try {
      const result = await svc.chat(
        req.tenantId, req.user.id,
        req.body.sessionId || null,
        req.body.message,
        req.body.providerId || null
      );
      return successResponse(res, result);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

module.exports = router;
