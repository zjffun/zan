import "server-only";

/**
 * Supabase settings. All Supabase traffic happens on the server (server
 * components, actions, route handlers), so none of this needs a NEXT_PUBLIC_
 * prefix, but the NEXT_PUBLIC_ names that Supabase's Vercel integration sets
 * are accepted too.
 */
export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function requireSupabaseConfig(): { url: string; key: string } {
  const config = supabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured: set SUPABASE_URL and SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return config;
}
