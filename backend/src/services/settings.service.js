/**
 * settings.service.js
 * Runtime configuration stored in system_settings table.
 * Values are Redis-cached (TTL 5 min) and invalidated on write.
 * Sensitive values (SMTP password, etc.) are AES-256-CBC encrypted.
 */
const crypto = require('crypto');
const { query } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');

const CACHE_PREFIX = 'settings:';
const CACHE_TTL    = 300; // 5 minutes

// Encryption key from dedicated env var (falls back to JWT_SECRET for migration)
const ENC_KEY = Buffer.from(
  (process.env.AI_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-key-32-chars-minimum!!').slice(0, 32).padEnd(32, '0')
);

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(ciphertext) {
  try {
    const [ivHex, dataHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// Defaults returned when no DB row exists yet
const DEFAULTS = {
  email: {
    host:       '',
    port:       '587',
    secure:     'false',
    user:       '',
    password:   '',
    from_name:  'SolarProcure',
    from_email: '',
    enabled:    'false',
  },
  security: {
    login_max_attempts:  '10',
    login_window_mins:   '15',
    lockout_mins:        '30',
    session_timeout_mins:'60',
    api_rate_limit:      '500',
    api_rate_window_mins:'15',
    reg_rate_limit:      '20',
    reg_rate_window_mins:'60',
  },
  storage: {
    max_file_size_mb:        '10',
    backup_retention_days:   '30',
    allowed_mime_types:      'application/pdf,image/jpeg,image/png,image/webp',
  },
  branding: {
    app_name:      'SolarProcure',
    support_email: '',
    logo_url:      '',
    primary_color: '#3B82F6',
  },
};

const ENCRYPTED_KEYS = new Set(['password']); // keys that get AES encrypted

async function cacheGet(category) {
  try {
    const raw = await redis.client?.get(`${CACHE_PREFIX}${category}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function cacheSet(category, data) {
  try {
    await redis.client?.setEx(`${CACHE_PREFIX}${category}`, CACHE_TTL, JSON.stringify(data));
  } catch {}
}

async function cacheInvalidate(category) {
  try {
    await redis.client?.del(`${CACHE_PREFIX}${category}`);
  } catch {}
}

/**
 * Get all settings for a category. Returns merged defaults + DB values.
 * Encrypted values are decrypted before returning (server-side only).
 * Never expose raw encrypted values to the client — use getForClient().
 */
async function get(category) {
  const cached = await cacheGet(category);
  if (cached) return cached;

  const defaults = DEFAULTS[category] || {};
  const result = { ...defaults };

  try {
    const rows = await query(
      'SELECT key, value, encrypted FROM system_settings WHERE category = $1',
      [category]
    );
    for (const row of rows.rows) {
      result[row.key] = row.encrypted ? decrypt(row.value) : row.value;
    }
  } catch (err) {
    logger.warn('settings.get DB error — using defaults', { category, error: err.message });
  }

  await cacheSet(category, result);
  return result;
}

/**
 * Get settings safe for the browser — encrypted values are masked.
 */
async function getForClient(category) {
  const data = await get(category);
  const safe = { ...data };
  for (const key of Object.keys(safe)) {
    if (ENCRYPTED_KEYS.has(key) && safe[key]) safe[key] = '••••••••';
  }
  return safe;
}

/**
 * Get all categories for client in one call.
 */
async function getAllForClient() {
  const categories = Object.keys(DEFAULTS);
  const out = {};
  await Promise.all(categories.map(async (cat) => {
    out[cat] = await getForClient(cat);
  }));
  return out;
}

/**
 * Upsert one or more keys in a category.
 * updatedBy: user UUID (optional, for audit trail)
 * sensitive: set of keys that should be encrypted
 */
async function set(category, updates, updatedBy = null) {
  for (const [key, value] of Object.entries(updates)) {
    const shouldEncrypt = ENCRYPTED_KEYS.has(key);
    // Don't overwrite an existing encrypted value if the client sent the mask
    if (shouldEncrypt && value === '••••••••') continue;

    const storedValue = (shouldEncrypt && value) ? encrypt(String(value)) : String(value ?? '');

    await query(
      `INSERT INTO system_settings (category, key, value, encrypted, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (category, key) DO UPDATE
         SET value = EXCLUDED.value,
             encrypted = EXCLUDED.encrypted,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by`,
      [category, key, storedValue, shouldEncrypt && !!value, updatedBy]
    );
  }
  await cacheInvalidate(category);
}

/**
 * Quick single-key getter — returns string value or default.
 */
async function getValue(category, key) {
  const data = await get(category);
  return data[key] ?? (DEFAULTS[category]?.[key] ?? null);
}

module.exports = { get, getForClient, getAllForClient, set, getValue, DEFAULTS };
