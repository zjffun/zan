import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { requireSupabaseConfig } from "./config";
import { sessionCookieOptions, shouldUseSecureCookie } from "./cookies";

/**
 * Supabase client acting as the signed-in user (session in cookies), so every
 * query runs under row level security. Reads cookies: call it from inside a
 * <Suspense> boundary, a Server Action or a Route Handler.
 */
export async function createClient() {
  // cookies() first: while prerendering this suspends the render right here, so a build
  // without Supabase credentials never reaches the configuration check below.
  const cookieStore = await cookies();
  // Session handling reads the clock (token expiry). Opt out of every kind of prerendering,
  // including the cookie-aware App Shell prefetch: user data is only ever produced per request.
  await connection();
  const secure = shouldUseSecureCookie({
    forwardedProto: (await headers()).get("x-forwarded-proto"),
    production: process.env.NODE_ENV === "production",
  });
  const { url, key } = requireSupabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, sessionCookieOptions(options, secure));
        } catch {
          // Called from a Server Component, which cannot set cookies. Safe to
          // ignore: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
