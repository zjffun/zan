import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions, shouldUseSecureCookie } from "./cookies";

/** Paths that need a signed-in user. */
const PROTECTED = [/^\/new(\/|$)/, /^\/settings(\/|$)/, /^\/favorites(\/|$)/, /^\/p\/[^/]+\/edit(\/|$)/];

/**
 * Runs before every matched request: refreshes the Supabase session cookie
 * (so server components see a valid session) and bounces anonymous visitors
 * away from the private part of the site. This is a convenience, not the
 * security boundary: every query is still guarded by row level security.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const secure = shouldUseSecureCookie({
    forwardedProto: request.headers.get("x-forwarded-proto"),
    protocol: request.nextUrl.protocol,
    production: process.env.NODE_ENV === "production",
  });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, sessionCookieOptions(options, secure));
        for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!signedIn && PROTECTED.some((pattern) => pattern.test(pathname))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(login);
    // keep any cookies the refresh just tried to clear
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}
