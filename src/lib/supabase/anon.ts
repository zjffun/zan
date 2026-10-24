import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

/**
 * Cookie-less client for public reads (published snapshots). It has no
 * session, so it can be used inside `'use cache'` functions. Returns null when
 * Supabase is not configured, e.g. during a build without credentials.
 */
export function createAnonClient() {
  const config = supabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
