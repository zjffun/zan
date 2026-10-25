import "server-only";
import { Redis } from "@upstash/redis";

/** How long a request may wait for Redis before we carry on without it. */
export const REDIS_TIMEOUT_MS = 1200;
/** After a failure, how long this instance leaves Redis alone (and counts in memory) before trying it again. */
export const REDIS_PAUSE_MS = 30_000;

let client: Redis | null | undefined;
let pausedUntil = 0;

/**
 * The shared Redis (Upstash, over HTTPS: no connections to manage in a serverless function), or
 * null when it is not configured. Everything that uses it keeps working without it, per instance
 * and in memory, so local development and a single server need no setup.
 *
 * Reads UPSTASH_REDIS_REST_URL / _TOKEN, which the Upstash integration in the Vercel Marketplace
 * sets, and the older KV_REST_API_URL / _TOKEN names.
 *
 * Also null for REDIS_PAUSE_MS after a failure was reported: a Redis that hangs would otherwise cost
 * every single request its full timeout. Only the first one pays; then the next try is a quiet retest.
 */
export function getRedis(): Redis | null {
  if (Date.now() < pausedUntil) return null;
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  // one quick retry: a user is waiting, and every caller has an in-memory fallback
  client = url && token ? new Redis({ url, token, retry: { retries: 1, backoff: () => 50 } }) : null;
  return client;
}

/** Rejects if `promise` takes longer than `ms`. The caller then falls back to memory. */
export async function withTimeout<T>(promise: PromiseLike<T>, ms = REDIS_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`redis did not answer within ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

let lastReport = 0;

/**
 * Callers tell us when Redis failed or timed out: it is left alone for a while, and the failure is
 * logged, at most once a minute (an outage must not flood the logs).
 */
export function reportRedisError(error: unknown): void {
  const now = Date.now();
  pausedUntil = now + REDIS_PAUSE_MS;
  if (now - lastReport < 60_000) return;
  lastReport = now;
  console.warn("[redis] unavailable, using in-memory state for now:", error instanceof Error ? error.message : error);
}
