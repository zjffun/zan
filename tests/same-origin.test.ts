import { describe, expect, it } from "vitest";
import { sameOrigin } from "@/lib/server/same-origin";

const request = (headers: Record<string, string>) => ({ headers: new Headers(headers) });

describe("sameOrigin", () => {
  it("lets a request from a page of this site through", () => {
    expect(sameOrigin(request({ origin: "https://zan.example", host: "zan.example" }))).toBe(true);
  });

  it("refuses a request from another site", () => {
    expect(sameOrigin(request({ origin: "https://evil.example", host: "zan.example" }))).toBe(false);
    expect(sameOrigin(request({ origin: "https://zan.example.evil.example", host: "zan.example" }))).toBe(false);
  });

  it("goes by the host the proxy forwarded, when there is one", () => {
    expect(sameOrigin(request({ origin: "https://zan.example", host: "internal:3000", "x-forwarded-host": "zan.example" }))).toBe(true);
    expect(sameOrigin(request({ origin: "https://internal:3000", host: "internal:3000", "x-forwarded-host": "zan.example" }))).toBe(false);
  });

  it("lets a client that sends no Origin through, and refuses one that sends rubbish", () => {
    expect(sameOrigin(request({ host: "zan.example" }))).toBe(true);
    expect(sameOrigin(request({ origin: "not a url", host: "zan.example" }))).toBe(false);
    // a browser's "null" origin (a sandboxed frame, a file) is not this site
    expect(sameOrigin(request({ origin: "null", host: "zan.example" }))).toBe(false);
  });
});
