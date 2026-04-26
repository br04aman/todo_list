import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const isRedisConfigured = !!REDIS_URL && REDIS_URL !== 'redis://localhost:6379' || process.env.NODE_ENV === 'development';

export const redis = isRedisConfigured
  ? new Redis(REDIS_URL!, {
      maxRetriesPerRequest: 1, // Fail fast in production if not available
      retryStrategy(times) {
        return times > 3 ? null : Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    })
  : ({
      get: async () => null,
      setex: async () => null,
      del: async () => null,
      keys: async () => [],
      incr: async () => 0,
      expire: async () => null,
      zadd: async () => null,
      zrem: async () => null,
      zrevrange: async () => [],
      zcard: async () => 0,
      ping: async () => 'PONG (simulated)',
      on: () => {},
    } as any);

if (isRedisConfigured) {
  redis.on('error', (err: any) => {
    console.warn('[Redis] Optional connection error:', err.message);
  });
}

// ——— Cache helpers ———

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get cached data by key
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Set cache with TTL
 */
export async function setCache(key: string, data: unknown, ttl = DEFAULT_TTL): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (err) {
    console.error('[Redis] Set cache error:', err);
  }
}

/**
 * Invalidate cache by key
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error('[Redis] Invalidate cache error:', err);
  }
}

/**
 * Invalidate all keys matching a pattern (e.g. tasks:userId:*)
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error('[Redis] Invalidate pattern error:', err);
  }
}

/**
 * Rate limiter: returns true if rate limit exceeded
 */
export async function isRateLimited(
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const key = `rate:${identifier}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    return current > maxRequests;
  } catch {
    return false; // fail open
  }
}

// ——— Redis Indexing (Sorted Sets) ———

/**
 * Add a task to the user's sorted set index.
 * Score = creation timestamp (ms) for chronological ordering.
 */
export async function indexTask(userId: string, taskId: string, createdAt: Date): Promise<void> {
  const key = `idx:tasks:user:${userId}`;
  try {
    await redis.zadd(key, createdAt.getTime(), taskId);
  } catch (err) {
    console.error('[Redis] Index task error:', err);
  }
}

/**
 * Remove a task from the user's sorted set index.
 */
export async function removeTaskIndex(userId: string, taskId: string): Promise<void> {
  const key = `idx:tasks:user:${userId}`;
  try {
    await redis.zrem(key, taskId);
  } catch (err) {
    console.error('[Redis] Remove task index error:', err);
  }
}

/**
 * Remove all task indexes for a user.
 */
export async function clearTaskIndex(userId: string): Promise<void> {
  const key = `idx:tasks:user:${userId}`;
  try {
    await redis.del(key);
  } catch (err) {
    console.error('[Redis] Clear task index error:', err);
  }
}

/**
 * Get task IDs from the user's index (newest first).
 * Supports pagination with offset and limit.
 */
export async function getTaskIdsByIndex(
  userId: string,
  offset = 0,
  limit = 50
): Promise<string[]> {
  const key = `idx:tasks:user:${userId}`;
  try {
    // ZREVRANGE returns highest scores first (newest tasks)
    return await redis.zrevrange(key, offset, offset + limit - 1);
  } catch (err) {
    console.error('[Redis] Get task IDs by index error:', err);
    return [];
  }
}

/**
 * Get total count of indexed tasks for a user.
 */
export async function getTaskIndexCount(userId: string): Promise<number> {
  const key = `idx:tasks:user:${userId}`;
  try {
    return await redis.zcard(key);
  } catch {
    return 0;
  }
}
