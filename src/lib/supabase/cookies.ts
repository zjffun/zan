import type { CookieOptions } from "@supabase/ssr";

/**
 * Does the user's browser talk to us over https? Behind a proxy or load
 * balancer (Vercel included) the original protocol arrives in x-forwarded-proto,
 * possibly as a list ("https,http"); the first entry is the client's.
 */
export function isHttpsRequest({ forwardedProto, protocol }: { forwardedProto?: string | null; protocol?: string | null }): boolean {
  const first = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (first) return first === "https";
  return protocol?.toLowerCase() === "https:" || protocol?.toLowerCase() === "https";
}

/**
 * Should the session cookie carry Secure? In production always: it is only ever served over https
 * (Vercel and every sane host terminate TLS), and if a proxy forgets x-forwarded-proto we would
 * rather fail loudly (the browser refuses the cookie, login does not stick) than silently send the
 * session over http. In development there is plain http (localhost, a phone on the LAN), where a
 * Secure cookie would be refused by Safari and on non-localhost addresses, so it follows the request.
 */
export function shouldUseSecureCookie(input: { forwardedProto?: string | null; protocol?: string | null; production: boolean }): boolean {
  return input.production || isHttpsRequest(input);
}

/** How long the browser keeps the session cookie after its last refresh: 30 days. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * The session cookie never needs to be readable by page scripts: every Supabase call happens on
 * the server and there is no browser client. So it is HttpOnly (a script injected into the page
 * cannot steal the session) and, on https, Secure.
 *
 * It lives 30 days (@supabase/ssr defaults to 400, the most Chrome allows). The lifetime is
 * rolling: every time the access token is refreshed (at most hourly while someone is using the
 * site) the cookie is written again with another 30 days, so you are signed out after 30 days of
 * not visiting, not every 30 days. The cookie that signs you out has maxAge 0 and stays 0.
 * Path and SameSite=Lax stay as @supabase/ssr chose them.
 */
export function sessionCookieOptions(options: CookieOptions, secure: boolean): CookieOptions {
  const removing = options.maxAge === 0;
  return { ...options, httpOnly: true, secure, ...(removing ? {} : { maxAge: SESSION_MAX_AGE_SECONDS }) };
}
