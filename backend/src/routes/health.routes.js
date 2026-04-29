const express = require('express');
const { testConnection: dbTest } = require('../config/database');
const { testConnection: redisTest } = require('../config/redis');

const router = express.Router();

router.get('/', async (req, res) => {
  const startTime = Date.now();

  const [dbOk, redisOk] = await Promise.allSettled([dbTest(), redisTest()]);

  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTimeMs: Date.now() - startTime,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: dbOk.status === 'fulfilled' && dbOk.value ? 'healthy' : 'unhealthy',
      redis: redisOk.status === 'fulfilled' && redisOk.value ? 'healthy' : 'unhealthy',
    },
  };

  const allHealthy = Object.values(status.services).every((s) => s === 'healthy');
  if (!allHealthy) status.status = 'degraded';

  return res.status(allHealthy ? 200 : 503).json(status);
});

// Kubernetes liveness probe (just checks process is alive)
router.get('/live', (req, res) => res.status(200).json({ alive: true }));

// Kubernetes readiness probe (checks dependencies)
router.get('/ready', async (req, res) => {
  try {
    const { pool } = require('../config/database');
    await pool.query('SELECT 1');
    return res.status(200).json({ ready: true });
  } catch {
    return res.status(503).json({ ready: false, reason: 'Database not ready' });
  }
});

module.exports = router;
