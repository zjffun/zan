import type { MetadataRoute } from "next";
import { siteUrlFallback } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrlFallback();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/p/"],
        // pages that are for signed-in people, or are results rather than content
        disallow: ["/api/", "/auth/", "/login", "/search", "/new", "/settings", "/favorites", "/report", "/p/*/edit"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
