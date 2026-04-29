/**
 * settings.routes.js
 * Admin-only runtime configuration API.
 * GET  /api/settings           → all categories (client-safe, passwords masked)
 * GET  /api/settings/:category → single category
 * PATCH /api/settings/:category → update category
 * POST /api/settings/email/test → send test email
 */
const router  = require('express').Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { successResponse, errorResponse }  = require('../utils/response');
const settingsSvc = require('../services/settings.service');
const emailSvc    = require('../services/email.service');

const VALID_CATEGORIES = ['email', 'security', 'storage', 'branding'];

router.use(authenticate);
router.use(requirePermission('settings', 'read'));

// GET /api/settings — all categories, client-safe
router.get('/', async (req, res, next) => {
  try {
    const data = await settingsSvc.getAllForClient();
    return successResponse(res, data);
  } catch (err) { next(err); }
});

// GET /api/settings/:category
router.get('/:category', async (req, res, next) => {
  const { category } = req.params;
  if (!VALID_CATEGORIES.includes(category))
    return errorResponse(res, 'Invalid settings category', 400, 'INVALID_CATEGORY');
  try {
    const data = await settingsSvc.getForClient(category);
    return successResponse(res, { category, settings: data });
  } catch (err) { next(err); }
});

// PATCH /api/settings/:category — requires settings:manage
router.patch('/:category',
  requirePermission('settings', 'manage'),
  async (req, res, next) => {
    const { category } = req.params;
    if (!VALID_CATEGORIES.includes(category))
      return errorResponse(res, 'Invalid settings category', 400, 'INVALID_CATEGORY');

    const updates = req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates))
      return errorResponse(res, 'Body must be a flat key-value object', 400, 'INVALID_BODY');

    // Whitelist keys to defaults
    const allowed = Object.keys(settingsSvc.DEFAULTS[category] || {});
    const filtered = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        filtered[key] = updates[key];
      }
    }
    if (Object.keys(filtered).length === 0)
      return errorResponse(res, 'No valid keys provided', 400, 'NO_VALID_KEYS');

    try {
      await settingsSvc.set(category, filtered, req.user.id);
      const data = await settingsSvc.getForClient(category);

      const { audit } = require('../services/audit.service');
      await audit.update(req, 'system_settings', category, null, filtered);

      return successResponse(res, { category, settings: data, message: 'Settings saved.' });
    } catch (err) { next(err); }
  }
);

// POST /api/settings/email/test — send test email to current user
router.post('/email/test',
  requirePermission('settings', 'manage'),
  async (req, res, next) => {
    try {
      const cfg = await settingsSvc.get('email');
      if (cfg.enabled !== 'true' || !cfg.host)
        return errorResponse(res, 'SMTP is not configured. Save your email settings first.', 400, 'SMTP_NOT_CONFIGURED');

      const result = await emailSvc.send({
        to:      req.user.email,
        subject: 'SolarProcure — SMTP test email',
        text:    'If you received this, your SMTP configuration is working correctly.',
        html:    '<p style="font-family:Arial,sans-serif">If you received this, your <strong>SMTP configuration is working correctly</strong>.<br><br>— SolarProcure</p>',
      });

      if (result.skipped || result.error)
        return errorResponse(res, result.error || 'Email could not be sent.', 502, 'EMAIL_FAILED');

      return successResponse(res, { message: `Test email sent to ${req.user.email}` });
    } catch (err) { next(err); }
  }
);

module.exports = router;
