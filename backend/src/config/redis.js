const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

async function testConnection() {
  try {
    await redis.ping();
    logger.info('Redis ping OK');
    return true;
  } catch (err) {
    logger.error('Redis connection failed', { error: err.message });
    return false;
  }
}

// Token blacklist (for logout / revocation)
async function blacklistToken(jti, expiresInSeconds) {
  await redis.setex(`blacklist:${jti}`, expiresInSeconds, '1');
}

async function isTokenBlacklisted(jti) {
  const val = await redis.get(`blacklist:${jti}`);
  return val === '1';
}

// Rate limiting cache helpers
async function incrementRateLimit(key, windowSeconds) {
  const multi = redis.multi();
  multi.incr(key);
  multi.expire(key, windowSeconds);
  const results = await multi.exec();
  return results[0][1]; // count
}

module.exports = { redis, testConnection, blacklistToken, isTokenBlacklisted, incrementRateLimit };
