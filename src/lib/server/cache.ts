import "server-only";

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
