import "server-only";
import { cacheLife } from "next/cache";
import { enabledProviders, type OAuthProvider } from "@/lib/auth-providers";
import { supabaseConfig } from "./config";

/**
 * The outside accounts that are switched on in Supabase (Authentication → Sign In / Providers), asked of the
 * project itself, so a button shows up when the provider is enabled there and not before: no setting to keep in
 * step here. Public information (it is what any client of the project can read), and the same for everybody, so
 * it is cached for a few minutes. When the project cannot be asked, there are no buttons, and e-mail still works.
 */
export async function enabledOAuthProviders(): Promise<OAuthProvider[]> {
  "use cache";
  cacheLife("minutes");

  const config = supabaseConfig();
  if (!config) return [];
  try {
    const response = await fetch(`${config.url.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: config.key },
      signal: AbortSignal.timeout(4000),
    });
    return response.ok ? enabledProviders(await response.json()) : [];
  } catch {
    return [];
  }
}
