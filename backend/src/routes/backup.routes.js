const express = require('express');
const { param, body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePermission } = require('../utils/rbac');
const { validate } = require('../middleware/validate.middleware');
const svc = require('../services/backup.service');
const { audit } = require('../services/audit.service');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

// GET /api/backup — list backups
router.get('/', requirePermission('backup','read'), async (req,res,next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await svc.listBackups(req.tenantId, { page, limit });
    return paginatedResponse(res, result.rows, result.total, page, limit);
  } catch(err){next(err);}
});

// GET /api/backup/restores — list restore jobs
router.get('/restores', requirePermission('backup','restore'), async (req,res,next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await svc.listRestoreJobs({ page, limit });
    return paginatedResponse(res, result.rows, result.total, page, limit);
  } catch(err){next(err);}
});

// GET /api/backup/:id — get single backup
router.get('/:id', requirePermission('backup','read'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const bj = await svc.getBackupJob(req.params.id);
      if (!bj) return errorResponse(res, 'Backup not found', 404);
      return successResponse(res, bj);
    } catch(err){next(err);}
  }
);

// POST /api/backup — trigger manual backup
router.post('/', requirePermission('backup','create'),
  [body('backupType').optional().isIn(['full','database','files'])], validate,
  async (req,res,next) => {
    try {
      const { backupType='full' } = req.body;
      const job = await svc.createBackup({
        tenantId: req.tenantId,
        userId: req.user.id,
        backupType,
        scope: 'system',
        triggerType: 'manual'
      });
      await audit.create(req, 'backup', job.id, { backupType, triggerType:'manual' });
      return successResponse(res, job, 202); // 202 Accepted — runs async
    } catch(err){next(err);}
  }
);

// GET /api/backup/:id/validate — validate backup integrity
router.get('/:id/validate', requirePermission('backup','read'),
  [param('id').isUUID()], validate,
  async (req,res,next) => {
    try {
      const result = await svc.validateBackup(req.params.id);
      return successResponse(res, result);
    } catch(err) {
      if(err.status) return errorResponse(res, err.message, err.status, err.code);
      next(err);
    }
  }
);

// POST /api/backup/:id/restore — initiate restore (returns confirmation token)
router.post('/:id/restore', requirePermission('backup','restore'),
  [param('id').isUUID(),
   body('restoreScope').optional().isIn(['full','database','files'])], validate,
  async (req,res,next) => {
    try {
      const rj = await svc.initiateRestore(req.params.id, req.user.id, req.body.restoreScope||'full');
      await audit.create(req, 'restore', rj.id, { backupId: req.params.id, scope: rj.restore_scope });
      return successResponse(res, {
        restoreJobId: rj.id,
        confirmationToken: rj.confirmationToken,
        message: 'Restore initiated. Confirm with the confirmation token to proceed.',
        warning: 'This will overwrite current data. Proceed with caution.'
      });
    } catch(err) {
      if(err.status) return errorResponse(res, err.message, err.status, err.code);
      next(err);
    }
  }
);

// POST /api/backup/restore/:restoreJobId/confirm — confirm and execute restore
router.post('/restore/:restoreJobId/confirm', requirePermission('backup','restore'),
  [param('restoreJobId').isUUID(),
   body('confirmationToken').notEmpty().withMessage('confirmationToken required')], validate,
  async (req,res,next) => {
    try {
      const rj = await svc.confirmRestore(req.params.restoreJobId, req.body.confirmationToken);
      await audit.update(req, 'restore', rj.id, { status:'pending' }, { status:'running', confirmed:true });
      return successResponse(res, {
        restoreJobId: rj.id,
        status: 'running',
        message: 'Restore started. Check status via GET /api/backup/restores.'
      });
    } catch(err) {
      if(err.status) return errorResponse(res, err.message, err.status, err.code);
      next(err);
    }
  }
);

// POST /api/backup/purge — purge expired backups (admin only)
router.post('/purge', requirePermission('backup','create'), async (req,res,next) => {
  try {
    const result = await svc.purgeExpiredBackups();
    await audit.create(req, 'backup_purge', null, result);
    return successResponse(res, result);
  } catch(err){next(err);}
});

module.exports = router;
