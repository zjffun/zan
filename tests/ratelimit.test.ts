import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redis: null as unknown,
  limit: vi.fn(),
  configs: [] as Record<string, unknown>[],
  report: vi.fn(),
}));

vi.mock("@/lib/server/redis", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/redis")>("@/lib/server/redis");
  return { ...actual, getRedis: () => mocks.redis, reportRedisError: mocks.report };
});

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static fixedWindow = (limit: number, window: string) => ({ kind: "fixedWindow", limit, window });
    constructor(config: Record<string, unknown>) {
      mocks.configs.push(config);
    }
    limit = mocks.limit;
  }
  return { Ratelimit };
});

import { rateLimit } from "@/lib/server/ratelimit";

let n = 0;
/** memory buckets live as long as the module: every test gets its own key */
const fresh = (name: string) => `${name}:${++n}`;

beforeEach(() => {
  mocks.redis = null;
  mocks.limit.mockReset();
  mocks.report.mockReset();
  mocks.configs.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit without Redis", () => {
  it("lets `limit` calls through, then blocks until the window is over", async () => {
    const key = fresh("memory");
    for (let i = 0; i < 3; i++) expect((await rateLimit(key, 3, 60_000)).ok).toBe(true);
    const blocked = await rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("counts every key on its own", async () => {
    const a = fresh("a");
    const b = fresh("b");
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(false);
    expect((await rateLimit(b, 1, 60_000)).ok).toBe(true);
  });

  it("starts a new window once the old one has passed", async () => {
    vi.useFakeTimers();
    const key = fresh("window");
    expect((await rateLimit(key, 1, 1_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 1_000)).ok).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect((await rateLimit(key, 1, 1_000)).ok).toBe(true);
  });
});

describe("rateLimit with Redis", () => {
  beforeEach(() => {
    mocks.redis = { fake: "redis" };
  });

  it("asks the shared limiter and reports its verdict", async () => {
    mocks.limit.mockResolvedValueOnce({ success: true, reset: Date.now() + 5_000 });
    expect(await rateLimit(fresh("ok"), 20, 600_000)).toEqual({ ok: true, retryAfter: 0 });

    mocks.limit.mockResolvedValueOnce({ success: false, reset: Date.now() + 42_000 });
    const blocked = await rateLimit(fresh("blocked"), 20, 600_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(41);
    expect(blocked.retryAfter).toBeLessThanOrEqual(42);
  });

  it("never reports a retry time under one second", async () => {
    mocks.limit.mockResolvedValueOnce({ success: false, reset: Date.now() - 10 });
    expect((await rateLimit(fresh("late"), 5, 1_000)).retryAfter).toBe(1);
  });

  it("makes one limiter per (limit, window), without the library's own fail-open timeout", async () => {
    mocks.limit.mockResolvedValue({ success: true, reset: Date.now() + 1_000 });
    await rateLimit(fresh("cfg"), 7, 90_000);
    await rateLimit(fresh("cfg"), 7, 90_000);
    await rateLimit(fresh("cfg"), 8, 90_000);
    const mine = mocks.configs.filter((c) => String(c.prefix).startsWith("zan:rl:7:90000") || String(c.prefix).startsWith("zan:rl:8:90000"));
    expect(mine).toHaveLength(2);
    expect(mine[0]).toMatchObject({
      prefix: "zan:rl:7:90000",
      limiter: { kind: "fixedWindow", limit: 7, window: "90000 ms" },
      timeout: 0,
      analytics: false,
    });
    expect(mine[1]).toMatchObject({ prefix: "zan:rl:8:90000" });
  });

  it("falls back to counting in memory when Redis fails, and says so", async () => {
    mocks.limit.mockRejectedValue(new Error("boom"));
    const key = fresh("down");
    expect((await rateLimit(key, 2, 60_000)).ok).toBe(true);
    expect((await rateLimit(key, 2, 60_000)).ok).toBe(true);
    expect((await rateLimit(key, 2, 60_000)).ok).toBe(false);
    expect(mocks.report).toHaveBeenCalled();
  });

  it("does not wait for a Redis that never answers", async () => {
    vi.useFakeTimers();
    mocks.limit.mockReturnValue(new Promise(() => {}));
    const key = fresh("slow");
    const pending = rateLimit(key, 1, 60_000);
    await vi.advanceTimersByTimeAsync(1_300);
    expect((await pending).ok).toBe(true);
    // and it keeps limiting, in memory
    const second = rateLimit(key, 1, 60_000);
    await vi.advanceTimersByTimeAsync(1_300);
    expect((await second).ok).toBe(false);
  });
});
