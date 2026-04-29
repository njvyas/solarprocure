const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Audit Log Service
 * All critical actions MUST be logged via this service.
 * Logs are immutable - no UPDATE or DELETE allowed on audit_logs.
 */

async function log({
  tenantId,
  userId = null,
  userEmail = null,
  action,
  resourceType,
  resourceId = null,
  oldValues = null,
  newValues = null,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  status = 'success',
}) {
  try {
    await query(
      `INSERT INTO audit_logs 
        (tenant_id, user_id, user_email, action, resource_type, resource_id, 
         old_values, new_values, metadata, ip_address, user_agent, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        tenantId,
        userId,
        userEmail,
        action,
        resourceType,
        resourceId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        JSON.stringify(metadata),
        ipAddress,
        userAgent,
        status,
      ]
    );
  } catch (err) {
    // Audit logging failure must NEVER crash the main request
    logger.error('Failed to write audit log', {
      error: err.message,
      action,
      tenantId,
      resourceType,
    });
  }
}

// Convenience wrappers
const audit = {
  loginSuccess: (req, user) =>
    log({
      tenantId: req.tenantId || user.tenant_id,
      userId: user.id,
      userEmail: user.email,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'success',
    }),

  loginFailed: (req, email, tenantId) =>
    log({
      tenantId,
      userId: null,
      userEmail: email,
      action: 'auth.login_failed',
      resourceType: 'user',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'failure',
    }),

  logout: (req) =>
    log({
      tenantId: req.tenantId,
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'auth.logout',
      resourceType: 'user',
      resourceId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }),

  tokenRefreshed: (req, userId) =>
    log({
      tenantId: req.tenantId,
      userId,
      action: 'auth.token_refreshed',
      resourceType: 'token',
      ipAddress: req.ip,
    }),

  create: (req, resourceType, resourceId, newValues) =>
    log({
      tenantId: req.tenantId,
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: `${resourceType}.created`,
      resourceType,
      resourceId,
      newValues,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }),

  update: (req, resourceType, resourceId, oldValues, newValues) =>
    log({
      tenantId: req.tenantId,
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: `${resourceType}.updated`,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }),

  delete: (req, resourceType, resourceId, oldValues) =>
    log({
      tenantId: req.tenantId,
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: `${resourceType}.deleted`,
      resourceType,
      resourceId,
      oldValues,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }),

  unauthorized: (req, action, resourceType) =>
    log({
      tenantId: req.tenantId,
      userId: req.user?.id,
      userEmail: req.user?.email,
      action,
      resourceType,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'unauthorized',
    }),
};

module.exports = { log, audit };
