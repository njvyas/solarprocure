const express = require('express');
const { param, body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate } = require('../middleware/validate.middleware');
const svc = require('../services/bidding.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

const router = express.Router();

// ── Public: vendor places bid via token ────────────────────
router.post('/bid/:token',
  [body('amount').isFloat({min:0.01}).withMessage('amount must be positive number')], validate,
  async (req,res,next) => {
    try {
      const result = await svc.placeBid(req.params.token, parseFloat(req.body.amount), req.ip);
      return successResponse(res, result);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

// ── Auth required below ────────────────────────────────────
router.use(authenticate);

router.get('/', requirePermission('rfqs','read'), async (req,res,next) => {
  try {
    const { page,limit } = parsePagination(req.query);
    const { rows,total } = await svc.getSessions(req.tenantId, { rfqId:req.query.rfqId, status:req.query.status, page, limit });
    return paginatedResponse(res, rows, total, page, limit);
  } catch(err){next(err);}
});

router.get('/rfq/:rfqId', requirePermission('rfqs','read'),
  [param('rfqId').isUUID()], validate,
  async (req,res,next) => {
    try {
      const sess = await svc.getSessionByRfq(req.tenantId, req.params.rfqId);
      if (!sess) return errorResponse(res,'No bidding session for this RFQ',404,'NOT_FOUND');
      return successResponse(res, sess);
    } catch(err){next(err);}
  }
);

router.get('/:id', requirePermission('rfqs','read'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const sess = await svc.getSession(req.tenantId, req.params.id);
      if (!sess) return errorResponse(res,'Session not found',404);
      return successResponse(res, sess);
    } catch(err){next(err);}
  }
);

router.post('/', requirePermission('rfqs','update'),
  [body('rfqId').isUUID(),
   body('title').notEmpty(),
   body('maxRounds').optional().isInt({min:1,max:10}),
   body('roundDurationMins').optional().isInt({min:5,max:480}),
   body('decrementType').optional().isIn(['percentage','fixed']),
   body('minDecrement').optional().isFloat({min:0.01})], validate,
  async (req,res,next) => {
    try {
      const sess = await svc.createSession(req.tenantId, req.user.id, req.body);
      await audit.create(req,'bid_session',sess.id,{rfqId:req.body.rfqId,title:req.body.title});
      return successResponse(res, sess, 201);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.post('/:id/start-round', requirePermission('rfqs','update'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const result = await svc.startRound(req.tenantId, req.params.id, req.user.id);
      await audit.update(req,'bid_session',req.params.id,{},{round:result.session.current_round,status:'active'});
      return successResponse(res, result);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.post('/:id/end-round', requirePermission('rfqs','update'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const result = await svc.endRound(req.tenantId, req.params.id);
      await audit.update(req,'bid_session',req.params.id,{},{roundEnded:result.round.round_number,status:result.session.status});
      return successResponse(res, result);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

router.get('/:id/leaderboard', requirePermission('rfqs','read'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const data = await svc.getBidLeaderboard(req.tenantId, req.params.id, req.query.round);
      return successResponse(res, data);
    } catch(err) {
      if(err.status) return errorResponse(res,err.message,err.status,err.code);
      next(err);
    }
  }
);

module.exports = router;
