const { validationResult } = require('express-validator');
const { validationErrorResponse } = require('../utils/response');

/**
 * Run express-validator results and return 422 if any errors
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(
      res,
      errors.array().map((e) => ({
        field: e.path || e.param,
        message: e.msg,
        value: e.value,
      }))
    );
  }
  next();
}

/**
 * Sanitize string: trim + XSS-clean
 * Used as a custom sanitizer in express-validator chains
 */
const xss = require('xss');
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return xss(value.trim());
}

module.exports = { validate, sanitizeString };
