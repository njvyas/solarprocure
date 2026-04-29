/**
 * setup.routes.js
 * First-run setup wizard — only works on fresh installs (no tenants in DB).
 * GET  /api/setup/status      → { initialized: bool }
 * POST /api/setup/initialize  → creates first tenant + Super Admin
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query }  = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// Slugify helper
function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/setup/status
router.get('/status', async (req, res, next) => {
  try {
    const result = await query('SELECT COUNT(*) AS total FROM tenants', []);
    const initialized = parseInt(result.rows[0].total) > 0;
    return successResponse(res, { initialized });
  } catch (err) { next(err); }
});

// POST /api/setup/initialize
router.post('/initialize', async (req, res, next) => {
  try {
    // Guard: block if already initialized
    const check = await query('SELECT COUNT(*) AS total FROM tenants', []);
    if (parseInt(check.rows[0].total) > 0)
      return errorResponse(res, 'System already initialized. Use the admin panel to manage settings.', 409, 'ALREADY_INITIALIZED');

    const { companyName, email, password, firstName, lastName } = req.body;

    // Validate
    if (!companyName?.trim()) return errorResponse(res, 'Company name is required.', 400, 'MISSING_FIELD');
    if (!email?.trim())       return errorResponse(res, 'Admin email is required.', 400, 'MISSING_FIELD');
    if (!password || password.length < 8) return errorResponse(res, 'Password must be at least 8 characters.', 400, 'WEAK_PASSWORD');
    if (!firstName?.trim())   return errorResponse(res, 'First name is required.', 400, 'MISSING_FIELD');
    if (!lastName?.trim())    return errorResponse(res, 'Last name is required.', 400, 'MISSING_FIELD');

    // Validate email format
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) return errorResponse(res, 'Invalid email address.', 400, 'INVALID_EMAIL');

    const tenantId = uuidv4();
    const slug     = toSlug(companyName) || 'my-company';
    const userId   = uuidv4();
    const roleId   = uuidv4();
    const rounds   = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hash     = await bcrypt.hash(password, rounds);

    // Create tenant
    await query(
      `INSERT INTO tenants (id, name, slug, status, plan, settings)
       VALUES ($1, $2, $3, 'active', 'starter', '{}')`,
      [tenantId, companyName.trim(), slug]
    );

    // Create Super Admin role
    await query(
      `INSERT INTO roles (id, tenant_id, name, description, is_system, permissions)
       VALUES ($1, $2, 'Super Admin', 'Full system access.', true, '{"*":["*"]}')`,
      [roleId, tenantId]
    );

    // Create admin user
    await query(
      `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, status, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', true)`,
      [userId, tenantId, email.toLowerCase().trim(), hash, firstName.trim(), lastName.trim()]
    );

    // Assign Super Admin role
    await query(
      'INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)',
      [userId, roleId, tenantId]
    );

    logger.info('System initialized via setup wizard', {
      tenantId, tenantName: companyName, adminEmail: email,
    });

    return successResponse(res, {
      message: 'System initialized successfully. You can now log in.',
      tenantSlug: slug,
      email:      email.toLowerCase().trim(),
    }, 201);
  } catch (err) {
    logger.error('Setup initialization failed', { error: err.message });
    next(err);
  }
});

module.exports = router;
