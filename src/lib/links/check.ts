import "server-only";
import { BROWSER_USER_AGENT, fetchJson } from "../server/http";

export type SourceHealth = "ok" | "dead" | "unknown";

/**
 * Is this video still there? "unknown" means the platform did not give a
 * trustworthy answer (rate limit, anti-bot page, network error): the caller
 * must leave the stored status alone in that case.
 */
export async function checkVideoHealth(
  provider: string,
  ref: Record<string, unknown>,
): Promise<SourceHealth> {
  try {
    if (provider === "youtube" && typeof ref.videoId === "string") {
      const watch = `https://www.youtube.com/watch?v=${ref.videoId}`;
      const { status } = await fetchJson(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
        {},
        { timeoutMs: 5000 },
      );
      if (status === 200) return "ok";
      // deleted (404/400) and private or embedding-disabled (401/403) are both unplayable
      if ([400, 401, 403, 404].includes(status)) return "dead";
      return "unknown";
    }

    if (provider === "bilibili" && typeof ref.bvid === "string") {
      const { status, json } = await fetchJson(
        `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(ref.bvid)}`,
        { headers: { "User-Agent": BROWSER_USER_AGENT, Referer: "https://www.bilibili.com/" } },
        { timeoutMs: 5000 },
      );
      const code = (json as { code?: unknown } | null)?.code;
      if (status !== 200 || typeof code !== "number") return "unknown";
      if (code === 0) return "ok";
      // -404 deleted; 62002 hidden; 62004 under review; 62012 owner-only
      if ([-404, 62002, 62004, 62012].includes(code)) return "dead";
      return "unknown"; // -352 / -412 and friends: Bilibili is rate limiting us
    }
  } catch {
    return "unknown";
  }
  return "unknown";
}

/** Consecutive "dead" answers needed before a source is marked dead. */
export const DEAD_AFTER = 2;

export interface HealthState {
  status: "ok" | "dead";
  fail_count: number;
}

/**
 * Folds one check result into a source's stored state. Returns null when nothing
 * should change ("unknown": the platform gave no trustworthy answer).
 *
 * A single "dead" is not believed: platforms (Bilibili in particular) sometimes answer
 * rate-limited requests with a convincing "not found". Only DEAD_AFTER consecutive dead
 * answers flip the status; any ok answer revives the source and resets the counter.
 */
export function nextHealthState(current: HealthState, health: SourceHealth): HealthState | null {
  if (health === "unknown") return null;
  if (health === "ok") return { status: "ok", fail_count: 0 };
  const fail_count = Math.min(current.fail_count + 1, 100);
  return { status: fail_count >= DEAD_AFTER ? "dead" : current.status, fail_count };
}
