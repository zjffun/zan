import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

function authorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Operator takedown: hides a post from everybody, its author included,
 * immediately. Nothing is deleted, so a mistake can be undone with
 * `{"post":"…","restore":true}`.
 *
 *   curl -X POST $SITE/api/admin/takedown -H "Authorization: Bearer $ADMIN_SECRET" \
 *        -H 'content-type: application/json' -d '{"post":"<post id>"}'
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = z
    .object({ post: z.uuid(), restore: z.boolean().optional() })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "post (a post id) required" }, { status: 400 });

  const admin = createAdminClient();
  const updated = await admin
    .from("posts")
    .update({ removed_at: body.data.restore ? null : new Date().toISOString() })
    .eq("id", body.data.post)
    .select("id");
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });

  // expire = 0: never serve the taken-down post from the cache again
  revalidateTag(`post:${body.data.post}`, { expire: 0 });
  revalidateTag("feed", { expire: 0 });
  return NextResponse.json({ updated: updated.data?.length ?? 0, restored: Boolean(body.data.restore) });
}
