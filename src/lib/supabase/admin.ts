import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "./config";

/**
 * Service-role client: bypasses row level security. Only for trusted
 * background work (the dead-source checker). Never hand it user input without
 * validating it, and never import it from code that renders pages.
 */
export function createAdminClient() {
  const { url } = requireSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
