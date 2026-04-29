const express = require('express');
const { param, body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate, sanitizeString } = require('../middleware/validate.middleware');
const svc = require('../services/po.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

router.get('/stats', requirePermission('pos','read'), async (req,res,next) => {
  try { return successResponse(res, await svc.getStats(req.tenantId)); }
  catch(err){next(err);}
});

router.get('/', requirePermission('pos','read'), async (req,res,next) => {
  try {
    const {page,limit}=parsePagination(req.query);
    const {rows,total}=await svc.getPos(req.tenantId,{status:req.query.status,vendorId:req.query.vendorId,search:req.query.search,page,limit});
    return paginatedResponse(res,rows,total,page,limit);
  } catch(err){next(err);}
});

router.get('/:id', requirePermission('pos','read'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const po=await svc.getPoById(req.tenantId,req.params.id);
    if (!po) return errorResponse(res,'PO not found',404);
    return successResponse(res,po);
  } catch(err){next(err);}
});

router.post('/', requirePermission('pos','create'),
  [body('vendorId').isUUID(),
   body('title').notEmpty().customSanitizer(sanitizeString),
   body('totalAmount').isFloat({min:0.01}),
   body('items').optional().isArray()], validate,
  async (req,res,next) => {
    try {
      const po=await svc.createPo(req.tenantId,req.user.id,req.body);
      await audit.create(req,'purchase_order',po.id,{poNumber:po.po_number,vendor:req.body.vendorId});
      return successResponse(res,po,201);
    } catch(err){
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.patch('/:id', requirePermission('pos','update'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const old=await svc.getPoById(req.tenantId,req.params.id);
    const updated=await svc.updatePo(req.tenantId,req.params.id,req.user.id,req.body);
    await audit.update(req,'purchase_order',req.params.id,old,updated);
    return successResponse(res,updated);
  } catch(err){
    if(err.status) return errorResponse(res,err.message,err.status,err.code);
    next(err);
  }
});

router.post('/:id/submit', requirePermission('pos','create'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const po=await svc.submitForApproval(req.tenantId,req.params.id,req.user.id);
    await audit.update(req,'purchase_order',req.params.id,{status:'draft'},{status:'pending_approval'});
    return successResponse(res,po);
  } catch(err){
    if(err.status) return errorResponse(res,err.message,err.status,err.code);
    next(err);
  }
});

router.post('/:id/approve', requirePermission('pos','approve'),
  [param('id').isUUID(), body('comments').optional().isString()], validate,
  async (req,res,next) => {
    try {
      const po=await svc.approveOrReject(req.tenantId,req.params.id,req.user.id,'approved',req.body.comments);
      await audit.update(req,'purchase_order',req.params.id,{},{status:po.status,level:po.current_level});
      return successResponse(res,po);
    } catch(err){
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.post('/:id/reject', requirePermission('pos','approve'),
  [param('id').isUUID(), body('comments').notEmpty()], validate,
  async (req,res,next) => {
    try {
      const po=await svc.approveOrReject(req.tenantId,req.params.id,req.user.id,'rejected',req.body.comments);
      await audit.update(req,'purchase_order',req.params.id,{},{status:'rejected'});
      return successResponse(res,po);
    } catch(err){
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.post('/:id/request-changes', requirePermission('pos','approve'),
  [param('id').isUUID(), body('comments').notEmpty()], validate,
  async (req,res,next) => {
    try {
      const po=await svc.approveOrReject(req.tenantId,req.params.id,req.user.id,'requested_changes',req.body.comments);
      await audit.update(req,'purchase_order',req.params.id,{},{status:'draft'});
      return successResponse(res,po);
    } catch(err){
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.post('/:id/issue', requirePermission('pos','update'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const po=await svc.issuePo(req.tenantId,req.params.id,req.user.id);
    await audit.update(req,'purchase_order',req.params.id,{status:'approved'},{status:'issued'});
    return successResponse(res,po);
  } catch(err){
    if(err.status) return errorResponse(res,err.message,err.status,err.code);
    next(err);
  }
});

router.post('/:id/cancel', requirePermission('pos','update'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const po=await svc.cancelPo(req.tenantId,req.params.id,req.user.id,req.body.reason);
      await audit.update(req,'purchase_order',req.params.id,{},{status:'cancelled'});
      return successResponse(res,po);
    } catch(err){
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

module.exports = router;
