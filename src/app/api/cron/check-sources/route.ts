import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { checkVideoHealth, nextHealthState } from "@/lib/links/check";
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
 * Dead-source detector, run by a scheduler (vercel.json). It re-checks the
 * least recently checked YouTube/Bilibili sources and flips `status` between
 * ok and dead (after two consecutive dead answers). Saved metadata keeps the notes
 * readable; the player is swapped for a "video unavailable" placeholder.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sources")
    .select("id, provider, ref, status, fail_count")
    .in("provider", ["youtube", "bilibili"])
    .order("checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = { checked: 0, ok: 0, dead: 0, unknown: 0, changed: 0 };
  const queue = [...(data ?? [])];

  async function worker() {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const health = await checkVideoHealth(row.provider, row.ref as Record<string, unknown>);
      summary.checked += 1;
      summary[health] += 1;
      const next = nextHealthState({ status: row.status, fail_count: row.fail_count }, health);
      if (!next) continue; // no trustworthy answer: leave it for the next run
      if (next.status !== row.status) summary.changed += 1;
      await admin
        .from("sources")
        .update({ status: next.status, fail_count: next.fail_count, checked_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return NextResponse.json(summary);
}
