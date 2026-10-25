import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { IMAGE_BUCKET, MAX_UPLOAD_BYTES, MAX_UPLOAD_EDGE, newImageKey } from "@/lib/image";
import { sniffImage } from "@/lib/image-sniff";
import { rateLimit } from "@/lib/server/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

const reply = (status: number, error: string, headers?: HeadersInit) => NextResponse.json({ error }, { status, headers });

/** The request came from a page of this site (a form on another site cannot upload as the signed-in user). */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // not sent by every client; the session cookie is SameSite=Lax anyway
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Stores one picture for a post: multipart form with a `file` field, answers with its key and size.
 *
 * The browser has already shrunk it, but nothing here trusts that: the file must be a signed-in
 * user's, within the rate limits, small, and — judged by its bytes, not its name or declared
 * type — a PNG, JPEG, WebP or GIF. The key is made here, under the user's own id, and is all a
 * post ever stores. Requests are capped near 4.5 MB by the host anyway.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply(403, "请求来源不对。");

  const user = await getCurrentUser();
  if (!user) return reply(401, "请先登录。");

  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return reply(411, "无法确定图片大小。");
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return reply(413, "图片太大了（最大 3 MB）。");

  const burst = await rateLimit(`upload:min:${user.id}`, 12, 60_000);
  const daily = await rateLimit(`upload:day:${user.id}`, 60, 24 * 60 * 60_000);
  const limited = !burst.ok ? burst : !daily.ok ? daily : null;
  if (limited) return reply(429, `上传太频繁，请 ${limited.retryAfter} 秒后再试。`, { "retry-after": String(limited.retryAfter) });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return reply(400, "没有收到图片。");
  if (file.size === 0) return reply(400, "图片是空的。");
  if (file.size > MAX_UPLOAD_BYTES) return reply(413, "图片太大了（最大 3 MB）。");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = sniffImage(bytes);
  if (!image) return reply(415, "不支持这种图片格式（支持 PNG、JPEG、WebP、GIF）。");
  if (image.width > MAX_UPLOAD_EDGE || image.height > MAX_UPLOAD_EDGE) {
    return reply(413, `图片尺寸太大了（最长边不超过 ${MAX_UPLOAD_EDGE} 像素）。`);
  }

  const key = newImageKey(user.id, image.type);
  const stored = await createAdminClient()
    .storage.from(IMAGE_BUCKET)
    // names never repeat, so a year-long cache is safe
    .upload(key, bytes, { contentType: image.type, cacheControl: "31536000", upsert: false });
  if (stored.error) {
    console.error("image upload failed:", stored.error.message);
    return reply(502, "上传失败，请稍后再试。");
  }

  return NextResponse.json({ key, width: image.width, height: image.height }, { headers: { "cache-control": "no-store" } });
}
