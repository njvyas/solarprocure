const express = require('express');
const { param, body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate } = require('../middleware/validate.middleware');
const svc = require('../services/evaluation.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('quotes','read'), async (req,res,next) => {
  try {
    const { page,limit }=parsePagination(req.query);
    const { rows,total }=await svc.getEvaluations(req.tenantId, { rfqId:req.query.rfqId, page, limit });
    return paginatedResponse(res,rows,total,page,limit);
  } catch(err){next(err);}
});

router.get('/:id', requirePermission('quotes','read'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const ev=await svc.getEvaluation(req.tenantId, req.params.id);
    if(!ev) return errorResponse(res,'Evaluation not found',404);
    return successResponse(res,ev);
  } catch(err){next(err);}
});

router.post('/', requirePermission('quotes','evaluate'),
  [body('rfqId').isUUID(),
   body('title').notEmpty(),
   body('evaluationType').optional().isIn(['weighted','l1','technical_commercial']),
   body('criteria').optional().isArray()], validate,
  async (req,res,next) => {
    try {
      const ev=await svc.createEvaluation(req.tenantId, req.user.id, req.body);
      await audit.create(req,'evaluation',ev.id,{rfqId:req.body.rfqId,type:req.body.evaluationType});
      return successResponse(res,ev,201);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.post('/:id/score', requirePermission('quotes','evaluate'),
  [param('id').isUUID(),
   body('vendorId').isUUID(),
   body('criterionId').isUUID(),
   body('rawScore').isFloat({min:0,max:100})], validate,
  async (req,res,next) => {
    try {
      const score=await svc.scoreVendor(req.tenantId,req.params.id,req.user.id,req.body.vendorId,req.body.criterionId,req.body.rawScore,req.body.notes);
      await audit.create(req,'eval_score',score.id,{vendor:req.body.vendorId,score:req.body.rawScore});
      return successResponse(res,score);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.post('/:id/finalize', requirePermission('quotes','evaluate'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const ev=await svc.finalizeEvaluation(req.tenantId,req.params.id,req.user.id);
      await audit.update(req,'evaluation',req.params.id,{status:'in_progress'},{status:'finalized'});
      return successResponse(res,ev);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

module.exports = router;
