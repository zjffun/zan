import type { MetadataRoute } from "next";
import { listPublicPages } from "@/lib/public";
import { siteUrlFallback } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrlFallback();
  let pages: Awaited<ReturnType<typeof listPublicPages>> = [];
  try {
    pages = await listPublicPages();
  } catch {
    // database unreachable: still serve the static entries
  }
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...pages.map((page) => ({
      url: `${base}/p/${page.slug}`,
      lastModified: new Date(page.published_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
