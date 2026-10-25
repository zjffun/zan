import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEYS = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  vi.resetModules(); // module state: the client, the pause
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const load = () => import("@/lib/server/redis");

describe("getRedis", () => {
  it("is null when nothing is configured, so everything stays in memory", async () => {
    const { getRedis } = await load();
    expect(getRedis()).toBeNull();
  });

  it("needs both the URL and the token", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    expect((await load()).getRedis()).toBeNull();
  });

  it("reads the Upstash names", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect((await load()).getRedis()).not.toBeNull();
  });

  it("reads the older Vercel KV names too", async () => {
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "token";
    expect((await load()).getRedis()).not.toBeNull();
  });

  it("returns the same client every time", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const { getRedis } = await load();
    expect(getRedis()).toBe(getRedis());
  });

  it("is left alone for a while after a failure, then tried again", async () => {
    vi.useFakeTimers();
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const { getRedis, reportRedisError, REDIS_PAUSE_MS } = await load();
    expect(getRedis()).not.toBeNull();

    reportRedisError(new Error("down"));
    expect(getRedis()).toBeNull();
    vi.advanceTimersByTime(REDIS_PAUSE_MS - 1);
    expect(getRedis()).toBeNull();
    vi.advanceTimersByTime(2);
    expect(getRedis()).not.toBeNull();
  });
});

describe("reportRedisError", () => {
  it("logs once a minute, not once per failure", async () => {
    vi.useFakeTimers();
    const { reportRedisError } = await load();
    reportRedisError(new Error("one"));
    reportRedisError(new Error("two"));
    expect(console.warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(61_000);
    reportRedisError(new Error("three"));
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});

describe("withTimeout", () => {
  it("passes a result through", async () => {
    const { withTimeout } = await load();
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it("passes an error through", async () => {
    const { withTimeout } = await load();
    await expect(withTimeout(Promise.reject(new Error("nope")), 50)).rejects.toThrow("nope");
  });

  it("gives up on a promise that never settles", async () => {
    vi.useFakeTimers();
    const { withTimeout } = await load();
    const pending = withTimeout(new Promise(() => {}), 100);
    const assertion = expect(pending).rejects.toThrow("did not answer within 100 ms");
    await vi.advanceTimersByTimeAsync(101);
    await assertion;
  });
});
