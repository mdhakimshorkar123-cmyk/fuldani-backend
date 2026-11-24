import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Redis is optional. When REDIS_URL is missing or the server is unreachable,
 * the cache layer transparently falls through to the database.
 */
export const redis: Redis | null = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5_000,
      retryStrategy: (times) => Math.min(times * 500, 10_000),
    })
  : null;

if (redis) {
  redis.on('ready', () => logger.info('🟥 Redis connected'));
  redis.on('error', (err) => logger.warn({ err: err.message }, 'Redis error — cache bypassed'));
} else {
  logger.warn('REDIS_URL not set — running without cache');
}

export const isRedisReady = () => redis?.status === 'ready';
