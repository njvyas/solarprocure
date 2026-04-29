const logger = require('../utils/logger');

/**
 * Global error handler
 * Must be registered LAST in express middleware chain
 */
function errorHandler(err, req, res, next) {
  // Don't expose internals
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    tenantId: req.tenantId,
    userId: req.user?.id,
  });

  // PostgreSQL constraint violations
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry: resource already exists',
      code: 'DUPLICATE_ENTRY',
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Referenced resource does not exist',
      code: 'FOREIGN_KEY_VIOLATION',
    });
  }

  // JWT errors (shouldn't reach here but safety net)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: 'Invalid token', code: 'TOKEN_INVALID' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
  }

  // Generic 500
  const isDev = process.env.NODE_ENV !== 'production';
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDev && { debug: err.message }),
  });
}

/**
 * 404 handler - must be registered before error handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
  });
}

module.exports = { errorHandler, notFoundHandler };
