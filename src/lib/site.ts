import "server-only";
import { headers } from "next/headers";

/** Canonical origin for absolute URLs (sitemap, OG, auth e-mail links). */
export function configuredSiteUrl(): string | null {
  const url = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

export function siteUrlFallback(): string {
  return configuredSiteUrl() ?? "http://localhost:3000";
}

/** Origin for auth e-mails: the configured one, else the request's own host. */
export async function requestSiteUrl(): Promise<string> {
  const configured = configuredSiteUrl();
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/** Only same-site relative paths: "/jars/x" yes, "//evil.example" and "https://…" no. */
export function safeNextPath(value: unknown, fallback = "/jars"): string {
  return typeof value === "string" && /^\/(?![/\\])[^\s]*$/.test(value) ? value : fallback;
}
