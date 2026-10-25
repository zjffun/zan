import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redis: null as unknown, report: vi.fn() }));

vi.mock("@/lib/server/redis", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/redis")>("@/lib/server/redis");
  return { ...actual, getRedis: () => mocks.redis, reportRedisError: mocks.report };
});

import { SharedCache } from "@/lib/server/cache";

/** Just the two commands the cache uses, over a Map: what Upstash does, minus the network. */
function fakeRedis() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn<(key: string, value: unknown, options?: { px: number }) => Promise<string>>(async (key, value) => {
      store.set(key, JSON.parse(JSON.stringify(value)));
      return "OK";
    }),
  };
}

beforeEach(() => {
  mocks.redis = null;
  mocks.report.mockReset();
});

describe("SharedCache without Redis", () => {
  it("computes once and then answers from memory", async () => {
    const cache = new SharedCache<{ n: number }>("t", 60_000);
    const compute = vi.fn(async () => ({ n: 1 }));
    expect(await cache.memo("k", compute)).toEqual({ n: 1 });
    expect(await cache.memo("k", compute)).toEqual({ n: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("does not keep what shouldCache refuses", async () => {
    const cache = new SharedCache<string>("t", 60_000);
    const compute = vi.fn(async () => "unknown");
    await cache.memo("k", compute, (v) => v !== "unknown");
    await cache.memo("k", compute, (v) => v !== "unknown");
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

describe("SharedCache with Redis", () => {
  it("stores a computed value under a namespaced key with the TTL", async () => {
    const redis = fakeRedis();
    mocks.redis = redis;
    const cache = new SharedCache<{ state: string }>("youtube", 3_600_000);
    await cache.memo("abc", async () => ({ state: "ok" }));
    expect(redis.set).toHaveBeenCalledWith("zan:cache:youtube:abc", { state: "ok" }, { px: 3_600_000 });
  });

  it("shares an answer between instances: the second one never computes", async () => {
    const redis = fakeRedis();
    mocks.redis = redis;
    const instanceA = new SharedCache<{ state: string }>("bilibili", 60_000);
    const instanceB = new SharedCache<{ state: string }>("bilibili", 60_000); // another server, empty memory
    const compute = vi.fn(async () => ({ state: "ok" }));
    await instanceA.memo("BV1", compute);
    expect(await instanceB.memo("BV1", compute)).toEqual({ state: "ok" });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("keeps namespaces apart", async () => {
    const redis = fakeRedis();
    mocks.redis = redis;
    await new SharedCache<string>("one", 60_000).memo("k", async () => "from one");
    expect(await new SharedCache<string>("two", 60_000).memo("k", async () => "from two")).toBe("from two");
  });

  it("answers from memory first, without asking Redis again", async () => {
    const redis = fakeRedis();
    mocks.redis = redis;
    const cache = new SharedCache<string>("t", 60_000);
    await cache.memo("k", async () => "v");
    await cache.memo("k", async () => "v");
    await cache.memo("k", async () => "v");
    expect(redis.get).toHaveBeenCalledTimes(1);
  });

  it("does not store what shouldCache refuses", async () => {
    const redis = fakeRedis();
    mocks.redis = redis;
    const cache = new SharedCache<string>("t", 60_000);
    await cache.memo("k", async () => "unknown", () => false);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("treats a missing or null entry as a miss", async () => {
    const redis = fakeRedis();
    redis.store.set("zan:cache:t:k", null);
    mocks.redis = redis;
    const compute = vi.fn(async () => "fresh");
    expect(await new SharedCache<string>("t", 60_000).memo("k", compute)).toBe("fresh");
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("still answers when reading from Redis fails", async () => {
    const redis = fakeRedis();
    redis.get.mockRejectedValue(new Error("down"));
    mocks.redis = redis;
    expect(await new SharedCache<string>("t", 60_000).memo("k", async () => "v")).toBe("v");
    expect(mocks.report).toHaveBeenCalled();
  });

  it("still answers when writing to Redis fails", async () => {
    const redis = fakeRedis();
    redis.set.mockRejectedValue(new Error("down"));
    mocks.redis = redis;
    const cache = new SharedCache<string>("t", 60_000);
    expect(await cache.memo("k", async () => "v")).toBe("v");
    expect(mocks.report).toHaveBeenCalled();
    // and this instance remembers it anyway
    const compute = vi.fn(async () => "other");
    expect(await cache.memo("k", compute)).toBe("v");
    expect(compute).not.toHaveBeenCalled();
  });

  it("does not wait for a Redis that never answers", async () => {
    vi.useFakeTimers();
    const redis = fakeRedis();
    redis.get.mockReturnValue(new Promise(() => {}));
    redis.set.mockReturnValue(new Promise(() => {}));
    mocks.redis = redis;
    const pending = new SharedCache<string>("t", 60_000).memo("k", async () => "v");
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await pending).toBe("v");
    vi.useRealTimers();
  });
});
