import { createHash } from 'node:crypto';
import { isRedisReady, redis } from './redis.js';
import { logger } from './logger.js';

const PREFIX = 'sf';

/** Logical cache namespaces. Bumping a namespace version invalidates every key in it. */
export type CacheNamespace = 'products' | 'categories' | 'showcases' | 'zones' | 'stats';

export const TTL = {
  short: 60,
  medium: 60 * 5,
  long: 60 * 30,
} as const;

async function namespaceVersion(ns: CacheNamespace): Promise<string> {
  return (await redis!.get(`${PREFIX}:ns:${ns}`)) ?? '0';
}

/** Build a stable key from any params object (order-independent). */
export function keyOf(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      if (params[k] !== undefined && params[k] !== '') acc[k] = params[k];
      return acc;
    }, {});
  return createHash('sha1').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
}

/**
 * Read-through cache. Never throws because of Redis — on any cache error
 * the loader result is returned directly.
 */
export async function cached<T>(
  ns: CacheNamespace,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (!isRedisReady()) return loader();

  let fullKey: string | null = null;
  try {
    const version = await namespaceVersion(ns);
    fullKey = `${PREFIX}:${ns}:v${version}:${key}`;
    const hit = await redis!.get(fullKey);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn({ err, ns, key }, 'cache read failed');
  }

  const data = await loader();

  if (fullKey) {
    redis!
      .set(fullKey, JSON.stringify(data), 'EX', ttlSeconds)
      .catch((err) => logger.warn({ err, ns, key }, 'cache write failed'));
  }
  return data;
}

/** O(1) invalidation: bump namespace versions; stale keys expire via TTL. */
export async function invalidate(...namespaces: CacheNamespace[]): Promise<void> {
  if (!isRedisReady()) return;
  try {
    const pipeline = redis!.pipeline();
    for (const ns of namespaces) pipeline.incr(`${PREFIX}:ns:${ns}`);
    await pipeline.exec();
  } catch (err) {
    logger.warn({ err, namespaces }, 'cache invalidation failed');
  }
}
