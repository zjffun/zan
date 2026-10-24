import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/public";
import { createAdminClient } from "@/lib/supabase/admin";

function authorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Operator takedown: removes a published page (its snapshot) immediately.
 * The owner's private jar is untouched and goes back to "private".
 *
 *   curl -X POST $SITE/api/admin/takedown -H "Authorization: Bearer $ADMIN_SECRET" \
 *        -H 'content-type: application/json' -d '{"slug":"…"}'
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = z.object({ slug: z.string().regex(SLUG_PATTERN) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const admin = createAdminClient();
  const removed = await admin.from("publications").delete().eq("slug", body.data.slug).select("jar_id");
  if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
  const jarIds = (removed.data ?? []).map((r) => r.jar_id);
  if (jarIds.length > 0) await admin.from("jars").update({ visibility: "private" }).in("id", jarIds);

  // expire = 0: never serve the taken-down page from the cache again
  revalidateTag(`pub:${body.data.slug}`, { expire: 0 });
  revalidateTag("pub:index", { expire: 0 });
  return NextResponse.json({ removed: jarIds.length });
}
