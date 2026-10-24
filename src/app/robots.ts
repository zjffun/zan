import type { MetadataRoute } from "next";
import { siteUrlFallback } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrlFallback();
  return {
    rules: [{ userAgent: "*", allow: ["/", "/p/"], disallow: ["/jars", "/api/", "/auth/", "/login", "/search"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
