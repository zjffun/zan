import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "./config";

/**
 * Supabase client acting as the signed-in user (session in cookies), so every
 * query runs under row level security. Reads cookies: call it from inside a
 * <Suspense> boundary, a Server Action or a Route Handler.
 */
export async function createClient() {
  // cookies() first: while prerendering this suspends the render right here, so a build
  // without Supabase credentials never reaches the configuration check below.
  const cookieStore = await cookies();
  const { url, key } = requireSupabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, which cannot set cookies. Safe to
          // ignore: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
