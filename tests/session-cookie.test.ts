import { describe, expect, it } from "vitest";
import { isHttpsRequest, SESSION_MAX_AGE_SECONDS, sessionCookieOptions, shouldUseSecureCookie } from "@/lib/supabase/cookies";

describe("isHttpsRequest", () => {
  it("trusts the protocol the proxy reports for the browser", () => {
    expect(isHttpsRequest({ forwardedProto: "https" })).toBe(true);
    expect(isHttpsRequest({ forwardedProto: "https,http" })).toBe(true);
    expect(isHttpsRequest({ forwardedProto: " HTTPS " })).toBe(true);
    expect(isHttpsRequest({ forwardedProto: "http" })).toBe(false);
    // the client's hop is the first one: a later "https" does not make the request secure
    expect(isHttpsRequest({ forwardedProto: "http,https" })).toBe(false);
  });

  it("falls back to the request's own protocol", () => {
    expect(isHttpsRequest({ protocol: "https:" })).toBe(true);
    expect(isHttpsRequest({ protocol: "http:" })).toBe(false);
    expect(isHttpsRequest({ forwardedProto: null, protocol: "https:" })).toBe(true);
    // a forwarded header wins over the internal hop (a TLS terminator talking http to us)
    expect(isHttpsRequest({ forwardedProto: "https", protocol: "http:" })).toBe(true);
    expect(isHttpsRequest({ forwardedProto: "http", protocol: "https:" })).toBe(false);
  });

  it("is not secure when nothing says so", () => {
    expect(isHttpsRequest({})).toBe(false);
    expect(isHttpsRequest({ forwardedProto: "", protocol: null })).toBe(false);
  });
});

describe("shouldUseSecureCookie", () => {
  it("is always Secure in production, whatever the proxy says", () => {
    expect(shouldUseSecureCookie({ production: true })).toBe(true);
    expect(shouldUseSecureCookie({ forwardedProto: "http", protocol: "http:", production: true })).toBe(true);
    expect(shouldUseSecureCookie({ forwardedProto: "https", production: true })).toBe(true);
  });

  it("follows the request in development, so plain http (localhost, the LAN) keeps working", () => {
    expect(shouldUseSecureCookie({ protocol: "http:", production: false })).toBe(false);
    expect(shouldUseSecureCookie({ forwardedProto: "http", production: false })).toBe(false);
    expect(shouldUseSecureCookie({ forwardedProto: "https", production: false })).toBe(true);
  });
});

describe("sessionCookieOptions", () => {
  const supabaseDefaults = { path: "/", sameSite: "lax" as const, httpOnly: false, maxAge: 400 * 24 * 60 * 60 };

  it("makes the cookie HttpOnly, 30 days long, and keeps everything else", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(2_592_000);
    expect(sessionCookieOptions(supabaseDefaults, false)).toEqual({
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: false,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  });

  it("adds Secure on https", () => {
    expect(sessionCookieOptions(supabaseDefaults, true)).toMatchObject({ httpOnly: true, secure: true, maxAge: SESSION_MAX_AGE_SECONDS });
  });

  it("gives every refresh a fresh 30 days, whatever lifetime the library asked for", () => {
    expect(sessionCookieOptions({ maxAge: 400 * 24 * 60 * 60 }, true).maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(sessionCookieOptions({}, true).maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("does not undo signing out (maxAge 0) and cannot be loosened by what the library passes in", () => {
    expect(sessionCookieOptions({ ...supabaseDefaults, maxAge: 0 }, true)).toMatchObject({ maxAge: 0, httpOnly: true, secure: true });
    expect(sessionCookieOptions({ httpOnly: false, secure: false }, true)).toMatchObject({ httpOnly: true, secure: true });
  });
});
