import "server-only";
import { getRedis, reportRedisError, withTimeout } from "./redis";

/**
 * Tiny in-memory TTL cache. Per server instance only: good enough to absorb
 * repeated lookups of the same video/work and to keep us under the upstream
 * rate limits. Swap for Redis/KV if you run many instances.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): V | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.entries.size >= this.maxEntries) {
      // Map keeps insertion order: drop the oldest entry
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  /** Returns the cached value, or computes and caches it. Failures are not cached. */
  async memo(key: string, compute: () => Promise<V>, shouldCache: (v: V) => boolean = () => true): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await compute();
    if (shouldCache(value)) this.set(key, value);
    return value;
  }
}

/**
 * A cache for answers from other sites (YouTube, Bilibili, Bangumi, Open Library): two layers.
 * This instance's memory answers first; behind it, when Redis is configured, one shared copy
 * serves every instance, so each answer is fetched upstream about once per TTL no matter how many
 * serverless instances there are. That matters most for Bilibili, which blocks callers that ask
 * too often. Without Redis it is just the in-memory cache. A Redis that is slow or down is
 * skipped, never waited for: the answer is simply fetched again.
 *
 * Values must survive JSON (they are stored as JSON in Redis).
 */
export class SharedCache<V> {
  private readonly local: TtlCache<V>;

  constructor(
    private readonly namespace: string,
    private readonly ttlMs: number,
    maxEntries = 500,
  ) {
    this.local = new TtlCache<V>(ttlMs, maxEntries);
  }

  /** Returns the cached value, or computes and caches it. Values for which `shouldCache` is false are not kept. */
  async memo(key: string, compute: () => Promise<V>, shouldCache: (v: V) => boolean = () => true): Promise<V> {
    const hit = this.local.get(key);
    if (hit !== undefined) return hit;

    const redis = getRedis();
    const redisKey = `zan:cache:${this.namespace}:${key}`;
    if (redis) {
      try {
        const shared = await withTimeout(redis.get<V>(redisKey));
        if (shared !== null && shared !== undefined) {
          this.local.set(key, shared);
          return shared;
        }
      } catch (error) {
        reportRedisError(error);
      }
    }

    const value = await compute();
    if (shouldCache(value)) {
      this.local.set(key, value);
      if (redis) {
        try {
          await withTimeout(redis.set(redisKey, value, { px: this.ttlMs }));
        } catch (error) {
          reportRedisError(error);
        }
      }
    }
    return value;
  }
}
