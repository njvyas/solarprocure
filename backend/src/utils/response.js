/**
 * Standardised API response helpers
 * All responses follow: { success, data/error, meta }
 */

function successResponse(res, data, status = 200, meta = {}) {
  return res.status(status).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

function paginatedResponse(res, data, total, page, limit) {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    },
  });
}

function errorResponse(res, message, status = 400, code = null, details = null) {
  const body = {
    success: false,
    error: message,
    meta: { timestamp: new Date().toISOString() },
  };
  if (code) body.code = code;
  if (details) body.details = details;
  return res.status(status).json(body);
}

function validationErrorResponse(res, errors) {
  return res.status(422).json({
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors,
    meta: { timestamp: new Date().toISOString() },
  });
}

// Parse pagination query params safely
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 25));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// Parse sort params safely (whitelist approach)
function parseSort(query, allowedFields, defaultField = 'created_at', defaultDir = 'DESC') {
  const field = allowedFields.includes(query.sort_by) ? query.sort_by : defaultField;
  const dir = query.sort_dir?.toUpperCase() === 'ASC' ? 'ASC' : defaultDir;
  return { field, dir };
}

module.exports = {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  parsePagination,
  parseSort,
};
