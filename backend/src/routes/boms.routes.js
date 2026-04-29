const express = require('express');
const { param, body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate, sanitizeString } = require('../middleware/validate.middleware');
const svc = require('../services/bom.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

// GET /api/boms
router.get('/', requirePermission('boms','read'), async (req,res,next) => {
  try {
    const { page,limit } = parsePagination(req.query);
    const { rows, total } = await svc.getBoms(req.tenantId, { status:req.query.status, search:req.query.search, page, limit });
    return paginatedResponse(res, rows, total, page, limit);
  } catch(err){next(err);}
});

// GET /api/boms/stats
router.get('/stats', requirePermission('boms','read'), async (req,res,next) => {
  try {
    const { query } = require('../config/database');
    const r = await query(
      `SELECT status,COUNT(*) count, COALESCE(SUM(total_estimated_cost),0) total_value
       FROM boms WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status`,
      [req.tenantId]
    );
    const stats = { draft:{count:0,value:0}, published:{count:0,value:0}, archived:{count:0,value:0}, total:0 };
    for(const row of r.rows){ stats[row.status]={count:parseInt(row.count),value:parseFloat(row.total_value)}; stats.total+=parseInt(row.count); }
    return successResponse(res, stats);
  } catch(err){next(err);}
});

// GET /api/boms/:id
router.get('/:id', requirePermission('boms','read'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const bom = await svc.getBomById(req.tenantId, req.params.id);
    if (!bom) return errorResponse(res,'BOM not found',404);
    return successResponse(res, bom);
  } catch(err){next(err);}
});

// POST /api/boms
router.post('/', requirePermission('boms','create'),
  [body('name').notEmpty().customSanitizer(sanitizeString),
   body('projectType').optional().isIn(['solar_epc','bess','hybrid','other']),
   body('capacityMw').optional().isFloat({min:0}),
   body('items').optional().isArray()], validate,
  async (req,res,next) => {
    try {
      const bom = await svc.createBom(req.tenantId, req.user.id, req.body);
      await audit.create(req,'bom',bom.id,{name:req.body.name});
      return successResponse(res, bom, 201);
    } catch(err){next(err);}
  }
);

// PATCH /api/boms/:id
router.patch('/:id', requirePermission('boms','update'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const old = await svc.getBomById(req.tenantId,req.params.id);
    const updated = await svc.updateBom(req.tenantId, req.params.id, req.user.id, req.body);
    await audit.update(req,'bom',req.params.id,old,updated);
    return successResponse(res,updated);
  } catch(err){
    if(err.status) return errorResponse(res,err.message,err.status,err.code);
    next(err);
  }
});

// POST /api/boms/:id/publish
router.post('/:id/publish', requirePermission('boms','update'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const updated = await svc.publishBom(req.tenantId, req.params.id, req.user.id);
    await audit.update(req,'bom',req.params.id,{status:'draft'},{status:'published'});
    return successResponse(res,updated);
  } catch(err){
    if(err.status) return errorResponse(res,err.message,err.status,err.code);
    next(err);
  }
});

// POST /api/boms/:id/archive
router.post('/:id/archive', requirePermission('boms','update'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    const updated = await svc.archiveBom(req.tenantId, req.params.id, req.user.id);
    await audit.update(req,'bom',req.params.id,{status:updated.status},{status:'archived'});
    return successResponse(res,updated);
  } catch(err){
    if(err.status) return errorResponse(res,err.message,err.status,err.code);
    next(err);
  }
});

// DELETE /api/boms/:id
router.delete('/:id', requirePermission('boms','delete'), [param('id').isUUID()], validate, async (req,res,next) => {
  try {
    await svc.deleteBom(req.tenantId, req.params.id);
    await audit.delete(req,'bom',req.params.id,{});
    return successResponse(res,{message:'BOM deleted'});
  } catch(err){
    if(err.status) return errorResponse(res,err.message,err.status,err.code);
    next(err);
  }
});

// POST /api/boms/:id/items
router.post('/:id/items', requirePermission('boms','update'),
  [param('id').isUUID(), body('items').isArray({min:1})], validate,
  async (req,res,next) => {
    try {
      const inserted = await svc.addItems(req.tenantId, req.params.id, req.body.items);
      await audit.create(req,'bom_items',req.params.id,{count:inserted.length});
      return successResponse(res,inserted,201);
    } catch(err){
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// PATCH /api/boms/:id/items/:itemId
router.patch('/:id/items/:itemId', requirePermission('boms','update'),
  [param('id').isUUID(), param('itemId').isUUID()], validate,
  async (req,res,next) => {
    try {
      const updated = await svc.updateItem(req.tenantId, req.params.id, req.params.itemId, req.body);
      return successResponse(res,updated);
    } catch(err){
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// DELETE /api/boms/:id/items/:itemId
router.delete('/:id/items/:itemId', requirePermission('boms','delete'),
  [param('id').isUUID(), param('itemId').isUUID()], validate,
  async (req,res,next) => {
    try {
      await svc.deleteItem(req.tenantId, req.params.id, req.params.itemId);
      return successResponse(res,{message:'Item deleted'});
    } catch(err){
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// POST /api/boms/:id/import  (JSON rows — no Excel dep required)
router.post('/:id/import', requirePermission('boms','update'),
  [param('id').isUUID(), body('rows').isArray({min:1})], validate,
  async (req,res,next) => {
    try {
      const inserted = await svc.importItems(req.tenantId, req.params.id, req.user.id, req.body.rows);
      await audit.create(req,'bom_import',req.params.id,{rowCount:inserted.length});
      return successResponse(res,{imported:inserted.length,items:inserted},200);
    } catch(err){
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

module.exports = router;
