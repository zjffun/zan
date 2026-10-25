import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { checkVideoHealth, healthUpdate } from "@/lib/links/check";
import { createAdminClient } from "@/lib/supabase/admin";

/** Sources checked per run. Keep it small enough to finish inside the function time limit. */
const BATCH = 30;
const CONCURRENCY = 5;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Dead-video detector, run by a scheduler (vercel.json). It re-checks the
 * least recently checked YouTube/Bilibili videos that posts point at and flips
 * `source_status` between ok and dead (after two consecutive dead answers). The
 * saved metadata keeps the post readable; the player is swapped for a "video
 * unavailable" placeholder.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("posts")
    .select("id, source, source_status, source_fail_count")
    .in("source->>provider", ["youtube", "bilibili"])
    .order("source_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = { checked: 0, ok: 0, dead: 0, unknown: 0, changed: 0 };
  const queue = [...(data ?? [])];

  async function worker() {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const source = row.source as { provider?: string; ref?: Record<string, unknown> } | null;
      const health = await checkVideoHealth(source?.provider ?? "", source?.ref ?? {});
      summary.checked += 1;
      summary[health] += 1;
      // no trustworthy answer ("unknown"): the status stays, but the post goes to the back of the queue
      const update = healthUpdate({ status: row.source_status, fail_count: row.source_fail_count }, health, new Date());
      await admin.from("posts").update(update).eq("id", row.id);
      if (update.source_status !== undefined && update.source_status !== row.source_status) {
        summary.changed += 1;
        // the post page and the cards show a "video unavailable" notice now (or no longer)
        revalidateTag(`post:${row.id}`, { expire: 0 });
        revalidateTag("feed", { expire: 0 });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return NextResponse.json(summary);
}
