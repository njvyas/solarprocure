const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/database');
const logger = require('../utils/logger');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;

// Ensure backup directory exists
['db','files','temp'].forEach(sub => {
  const d = path.join(BACKUP_DIR, sub);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── List backups ────────────────────────────────────────────
async function listBackups(tenantId, { page=1, limit=25 } = {}) {
  const offset = (page-1)*limit;
  const res = await query(
    `SELECT bj.*,
            u.first_name||' '||u.last_name as triggered_by_name,
            (bj.db_size_bytes + COALESCE(bj.files_size_bytes,0)) as total_size_bytes
     FROM backup_jobs bj
     LEFT JOIN users u ON u.id=bj.triggered_by
     WHERE (bj.tenant_id=$1 OR bj.scope='system')
     ORDER BY bj.created_at DESC LIMIT $2 OFFSET $3`,
    [tenantId, limit, offset]
  );
  const cnt = await query(
    `SELECT COUNT(*) FROM backup_jobs WHERE (tenant_id=$1 OR scope='system')`,
    [tenantId]
  );
  return { rows: res.rows, total: parseInt(cnt.rows[0].count) };
}

// ── Create backup ───────────────────────────────────────────
async function createBackup({ tenantId=null, userId=null, backupType='full', scope='system', triggerType='manual' }) {
  // Create job record
  const jobRes = await query(
    `INSERT INTO backup_jobs (tenant_id, backup_type, scope, status, triggered_by, trigger_type)
     VALUES ($1,$2,$3,'pending',$4,$5) RETURNING *`,
    [tenantId, backupType, scope, userId, triggerType]
  );
  const job = jobRes.rows[0];

  // Run async (non-blocking)
  runBackup(job).catch(err => {
    logger.error('Backup job failed', { jobId: job.id, error: err.message });
  });

  return job;
}

async function runBackup(job) {
  const ts = new Date().toISOString().replace(/[:.]/g,'-').replace('T','-').slice(0,19);
  let dbFile = null, filesArchive = null;
  let dbSizeBytes = 0, filesSizeBytes = 0;

  try {
    // Mark as running
    await query(
      `UPDATE backup_jobs SET status='running', started_at=NOW() WHERE id=$1`,
      [job.id]
    );

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');

    // ── Database dump ────────────────────────────────────────
    if (['full','database'].includes(job.backup_type)) {
      dbFile = path.join(BACKUP_DIR, 'db', `backup-db-${ts}-${job.id.slice(0,8)}.sql.gz`);

      // pg_dump piped through gzip
      await new Promise((resolve, reject) => {
        const dump = spawn('sh', ['-c',
          `pg_dump "${dbUrl}" --no-password --format=plain --no-owner --no-acl | gzip > "${dbFile}"`
        ]);
        dump.on('close', code => code === 0 ? resolve() : reject(new Error(`pg_dump exited ${code}`)));
        dump.on('error', reject);
      });

      if (fs.existsSync(dbFile)) {
        dbSizeBytes = fs.statSync(dbFile).size;
      }
    }

    // ── Files archive ────────────────────────────────────────
    if (['full','files'].includes(job.backup_type) && fs.existsSync(UPLOAD_DIR)) {
      filesArchive = path.join(BACKUP_DIR, 'files', `backup-files-${ts}-${job.id.slice(0,8)}.tar.gz`);
      await new Promise((resolve, reject) => {
        const tar = spawn('tar', ['-czf', filesArchive, '-C', path.dirname(UPLOAD_DIR), path.basename(UPLOAD_DIR)]);
        tar.on('close', code => code === 0 ? resolve() : reject(new Error(`tar exited ${code}`)));
        tar.on('error', reject);
      });
      if (fs.existsSync(filesArchive)) {
        filesSizeBytes = fs.statSync(filesArchive).size;
      }
    }

    const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE backup_jobs SET
         status='completed', completed_at=NOW(), expires_at=$1,
         db_file=$2, files_archive=$3,
         db_size_bytes=$4, files_size_bytes=$5,
         metadata=$6
       WHERE id=$7`,
      [
        expiresAt,
        dbFile ? path.relative(BACKUP_DIR, dbFile) : null,
        filesArchive ? path.relative(BACKUP_DIR, filesArchive) : null,
        dbSizeBytes, filesSizeBytes || null,
        JSON.stringify({ timestamp: new Date().toISOString(), host: process.env.HOSTNAME || 'unknown' }),
        job.id
      ]
    );
    logger.info('Backup completed', { jobId: job.id, dbSizeBytes, filesSizeBytes });
  } catch (err) {
    logger.error('Backup failed', { jobId: job.id, error: err.message });
    // Clean up partial files
    if (dbFile && fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    if (filesArchive && fs.existsSync(filesArchive)) fs.unlinkSync(filesArchive);
    await query(
      `UPDATE backup_jobs SET status='failed', completed_at=NOW(), error_message=$1 WHERE id=$2`,
      [err.message, job.id]
    );
  }
}

// ── Validate backup ─────────────────────────────────────────
async function validateBackup(backupId) {
  const res = await query('SELECT * FROM backup_jobs WHERE id=$1', [backupId]);
  if (!res.rows.length) throw Object.assign(new Error('Backup not found'), { status:404 });
  const bj = res.rows[0];

  if (bj.status !== 'completed') {
    return { valid: false, reason: `Backup is in ${bj.status} state`, backup: bj };
  }

  const checks = [];

  if (bj.db_file) {
    const dbPath = path.join(BACKUP_DIR, bj.db_file);
    const exists = fs.existsSync(dbPath);
    const size = exists ? fs.statSync(dbPath).size : 0;
    checks.push({ type: 'database', file: bj.db_file, exists, size, sizeMatch: size === bj.db_size_bytes });
  }

  if (bj.files_archive) {
    const filesPath = path.join(BACKUP_DIR, bj.files_archive);
    const exists = fs.existsSync(filesPath);
    const size = exists ? fs.statSync(filesPath).size : 0;
    checks.push({ type: 'files', file: bj.files_archive, exists, size, sizeMatch: size === bj.files_size_bytes });
  }

  const allValid = checks.every(c => c.exists && c.sizeMatch);
  return { valid: allValid, checks, backup: bj };
}

// ── Initiate restore ─────────────────────────────────────────
async function initiateRestore(backupId, userId, restoreScope='full') {
  const validation = await validateBackup(backupId);
  if (!validation.valid) {
    throw Object.assign(new Error(`Backup validation failed: ${validation.reason || 'file integrity check failed'}`), { status:400, code:'BACKUP_INVALID' });
  }

  const confirmationToken = crypto.randomBytes(16).toString('hex');
  const res = await query(
    `INSERT INTO restore_jobs (backup_job_id, triggered_by, status, restore_scope, confirmation_token)
     VALUES ($1,$2,'pending',$3,$4) RETURNING *`,
    [backupId, userId, restoreScope, confirmationToken]
  );
  return { ...res.rows[0], confirmationToken };
}

// ── Confirm and execute restore ──────────────────────────────
async function confirmRestore(restoreJobId, confirmationToken) {
  const rjRes = await query(
    `SELECT rj.*, bj.db_file, bj.files_archive FROM restore_jobs rj
     JOIN backup_jobs bj ON bj.id=rj.backup_job_id
     WHERE rj.id=$1 AND rj.confirmation_token=$2 AND rj.status='pending'`,
    [restoreJobId, confirmationToken]
  );
  if (!rjRes.rows.length) {
    throw Object.assign(new Error('Invalid restore job or token'), { status:400, code:'INVALID_TOKEN' });
  }
  const rj = rjRes.rows[0];

  // Mark confirmed + running
  await query(
    `UPDATE restore_jobs SET confirmed=true, status='running', started_at=NOW() WHERE id=$1`,
    [restoreJobId]
  );

  // Run restore async
  runRestore(rj).catch(err => logger.error('Restore failed', { restoreJobId: rj.id, error: err.message }));
  return rj;
}

async function runRestore(rj) {
  try {
    const dbUrl = process.env.DATABASE_URL;

    if (['full','database'].includes(rj.restore_scope) && rj.db_file) {
      const dbPath = path.join(BACKUP_DIR, rj.db_file);
      if (!fs.existsSync(dbPath)) throw new Error(`Database backup file not found: ${rj.db_file}`);

      // Restore: gunzip | psql
      await new Promise((resolve, reject) => {
        const restore = spawn('sh', ['-c',
          `gunzip -c "${dbPath}" | psql "${dbUrl}" --no-password -q`
        ]);
        restore.on('close', code => code === 0 ? resolve() : reject(new Error(`psql restore exited ${code}`)));
        restore.on('error', reject);
      });
    }

    if (['full','files'].includes(rj.restore_scope) && rj.files_archive) {
      const filesPath = path.join(BACKUP_DIR, rj.files_archive);
      if (!fs.existsSync(filesPath)) throw new Error(`Files archive not found: ${rj.files_archive}`);

      await new Promise((resolve, reject) => {
        const tar = spawn('tar', ['-xzf', filesPath, '-C', path.dirname(UPLOAD_DIR)]);
        tar.on('close', code => code === 0 ? resolve() : reject(new Error(`tar restore exited ${code}`)));
        tar.on('error', reject);
      });
    }

    await query(
      `UPDATE restore_jobs SET status='completed', completed_at=NOW() WHERE id=$1`,
      [rj.id]
    );
    logger.info('Restore completed', { restoreJobId: rj.id });
  } catch (err) {
    await query(
      `UPDATE restore_jobs SET status='failed', completed_at=NOW(), error_message=$1 WHERE id=$2`,
      [err.message, rj.id]
    );
    logger.error('Restore failed', { restoreJobId: rj.id, error: err.message });
  }
}

// ── Get backup job ───────────────────────────────────────────
async function getBackupJob(backupId) {
  const res = await query(
    `SELECT bj.*, u.first_name||' '||u.last_name as triggered_by_name
     FROM backup_jobs bj LEFT JOIN users u ON u.id=bj.triggered_by
     WHERE bj.id=$1`,
    [backupId]
  );
  return res.rows[0] || null;
}

// ── Get restore history ──────────────────────────────────────
async function listRestoreJobs({ page=1, limit=25 } = {}) {
  const offset = (page-1)*limit;
  const res = await query(
    `SELECT rj.*, bj.backup_type, bj.created_at as backup_created_at,
            u.first_name||' '||u.last_name as triggered_by_name
     FROM restore_jobs rj
     JOIN backup_jobs bj ON bj.id=rj.backup_job_id
     LEFT JOIN users u ON u.id=rj.triggered_by
     ORDER BY rj.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const cnt = await query('SELECT COUNT(*) FROM restore_jobs');
  return { rows: res.rows, total: parseInt(cnt.rows[0].count) };
}

// ── Purge expired backups ────────────────────────────────────
async function purgeExpiredBackups() {
  const expired = await query(
    `SELECT * FROM backup_jobs WHERE status='completed' AND expires_at < NOW()`
  );

  let purged = 0;
  for (const bj of expired.rows) {
    try {
      if (bj.db_file) {
        const p = path.join(BACKUP_DIR, bj.db_file);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      if (bj.files_archive) {
        const p = path.join(BACKUP_DIR, bj.files_archive);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      await query(`UPDATE backup_jobs SET status='expired' WHERE id=$1`, [bj.id]);
      purged++;
    } catch (err) {
      logger.warn('Failed to purge backup', { id: bj.id, error: err.message });
    }
  }
  logger.info('Purged expired backups', { count: purged });
  return { purged };
}

// ── Scheduler: daily backup ──────────────────────────────────
function startScheduler() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  async function runScheduled() {
    try {
      logger.info('Scheduled backup starting...');
      await createBackup({ backupType: 'full', scope: 'system', triggerType: 'scheduled' });
      await purgeExpiredBackups();
    } catch (err) {
      logger.error('Scheduled backup error', { error: err.message });
    }
  }

  // Run once after 1 minute on startup (avoid immediate disk hit during deploy)
  const startupTimer = setTimeout(runScheduled, 60 * 1000);
  // Then daily
  const interval = setInterval(runScheduled, INTERVAL_MS);

  return () => { clearTimeout(startupTimer); clearInterval(interval); };
}

module.exports = { listBackups, createBackup, validateBackup, initiateRestore, confirmRestore, getBackupJob, listRestoreJobs, purgeExpiredBackups, startScheduler };
