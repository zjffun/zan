import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import { getRedis, reportRedisError, withTimeout } from "./redis";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  /** seconds until the window resets (only meaningful when !ok) */
  retryAfter: number;
}

/** Fixed-window counters in this process's memory: the fallback, and all there is without Redis. */
function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  bucket.count += 1;
  return {
    ok: bucket.count <= limit,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

// one limiter per distinct (limit, window), created on first use
const limiters = new Map<string, Ratelimit>();

function limiterFor(redis: Redis, limit: number, windowMs: number): Ratelimit {
  const id = `${limit}:${windowMs}`;
  let limiter = limiters.get(id);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
      prefix: `zan:rl:${id}`,
      analytics: false,
      // 0 turns the library's own "let everybody through after N ms" off: our timeout below
      // falls back to counting in memory instead, so a slow Redis does not switch limiting off
      timeout: 0,
    });
    limiters.set(id, limiter);
  }
  return limiter;
}

/**
 * Fixed-window limiter: at most `limit` calls per `key` in `windowMs`. It protects the metadata,
 * search and publishing actions (and the upstream APIs behind them) from being hammered by one
 * user.
 *
 * With Redis configured the counters are shared by every server instance, which is what makes the
 * limit real on serverless hosting. Without it, or while Redis is slow or down, each instance counts
 * for itself (so the effective limit is looser, but nobody is locked out).
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) {
    try {
      const { success, reset } = await withTimeout(limiterFor(redis, limit, windowMs).limit(key));
      return { ok: success, retryAfter: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
    } catch (error) {
      reportRedisError(error);
    }
  }
  return memoryRateLimit(key, limit, windowMs);
}
