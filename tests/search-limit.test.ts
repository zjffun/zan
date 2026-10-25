import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/server/limits";
import { limitSearch } from "@/lib/server/search-limit";
import { addressOf } from "@/lib/server/request";

let n = 0;
const address = () => `198.51.100.${++n}`;
const ask = (path: string, from: string, headers: Record<string, string> = {}) =>
  limitSearch(new NextRequest(`http://localhost:3000${path}`, { headers: { "x-forwarded-for": from, ...headers } }));

describe("addressOf", () => {
  it("takes the first address of x-forwarded-for", () => {
    expect(addressOf(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  });
  it("is 'local' without the header", () => {
    expect(addressOf(new Headers())).toBe("local");
  });
});

describe("limitSearch", () => {
  it("lets exactly the allowed number of searches through, then answers 429 with a Chinese page and when to come back", async () => {
    const from = address();
    for (let i = 0; i < LIMITS.siteSearch.limit; i++) expect(await ask(`/search?q=a${i}`, from)).toBeNull();
    const refused = await ask("/search?q=one-more", from);
    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(refused?.headers.get("content-type")).toContain("text/html");
    expect(await refused?.text()).toContain("搜索太频繁");
  });

  it("counts per address", async () => {
    const a = address();
    for (let i = 0; i < LIMITS.siteSearch.limit; i++) await ask("/search?q=x", a);
    expect((await ask("/search?q=x", a))?.status).toBe(429);
    expect(await ask("/search?q=x", address())).toBeNull();
  });

  it("leaves everything but a real search alone", async () => {
    const from = address();
    for (let i = 0; i < LIMITS.siteSearch.limit + 5; i++) {
      expect(await ask("/search", from)).toBeNull(); // the empty search page
      expect(await ask("/search?q=%20%20", from)).toBeNull(); // only blanks
      expect(await ask("/tags?q=abc", from)).toBeNull(); // another page
      expect(await ask("/search?q=abc", from, { "next-router-prefetch": "1" })).toBeNull(); // a prefetch is not a visit
    }
    expect(await ask("/search?q=abc", from)).toBeNull(); // and none of that used up the allowance
  });
});
