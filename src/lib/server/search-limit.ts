import "server-only";
import type { NextRequest } from "next/server";
import { enforce, LIMITS } from "./limits";
import { addressOf } from "./request";

const isPrefetch = (request: NextRequest) =>
  request.headers.has("next-router-prefetch") || /prefetch/i.test(`${request.headers.get("purpose")} ${request.headers.get("sec-purpose")}`);

const page = (message: string) =>
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>搜索太频繁 · zan</title></head>` +
  `<body style="font-family:system-ui,sans-serif;text-align:center;padding:4rem 1rem"><h1 style="font-size:1.5rem">搜索太频繁</h1><p style="color:#666">${message}</p><p><a href="/">回首页</a></p></body></html>`;

/**
 * Counts a search by the address it came from, and answers 429 when that address has used up its minute.
 * Done here and not in the page: Next renders that page twice for one request (the count would be
 * doubled, and not even React's cache() collapses the two), while the proxy runs once.
 */
export async function limitSearch(request: NextRequest): Promise<Response | null> {
  if (request.nextUrl.pathname !== "/search" || isPrefetch(request)) return null;
  if (!request.nextUrl.searchParams.get("q")?.trim()) return null; // the empty search page costs nothing
  const result = await enforce(LIMITS.siteSearch, addressOf(request.headers));
  if (result.ok) return null;
  return new Response(page(`请 ${result.retryAfter} 秒后再试。`), {
    status: 429,
    headers: { "content-type": "text/html; charset=utf-8", "retry-after": String(result.retryAfter) },
  });
}
