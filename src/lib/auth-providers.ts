/** The outside accounts one can sign in with, besides an e-mail address. Plain data, so that forms can use it too. */
export const OAUTH_PROVIDERS = ["github", "google"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_LABELS: Record<OAuthProvider, string> = { github: "GitHub", google: "Google" };

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Which of ours are switched on, from what Supabase's `/auth/v1/settings` says: `{ "external": { "github": true,
 * "google": false, "email": true, … } }`. Anything else, an answer that is not that, counts as none.
 */
export function enabledProviders(settings: unknown): OAuthProvider[] {
  const external = typeof settings === "object" && settings !== null ? (settings as { external?: unknown }).external : undefined;
  if (typeof external !== "object" || external === null) return [];
  return OAUTH_PROVIDERS.filter((provider) => (external as Record<string, unknown>)[provider] === true);
}
