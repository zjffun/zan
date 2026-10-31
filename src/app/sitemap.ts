import type { MetadataRoute } from "next";
import { listSitemapEntries } from "@/lib/posts";
import { SCALES, isIndexable } from "@/lib/scales";
import { siteUrlFallback } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrlFallback();
  let entries: Awaited<ReturnType<typeof listSitemapEntries>> = { posts: [], tags: [] };
  try {
    entries = await listSitemapEntries();
  } catch {
    // database unreachable: still serve the static entries
  }
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/tags`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/scales`, changeFrequency: "monthly", priority: 0.5 },
    ...SCALES.filter(isIndexable).map((scale) => ({ url: `${base}/scales/${scale.id}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...entries.tags.map((tag) => ({ url: `${base}/t/${tag.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
    ...entries.posts.map((post) => ({
      url: `${base}/p/${post.id}`,
      lastModified: new Date(post.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
