import "server-only";
import { rateLimit } from "./ratelimit";

/** How many tags one person may create: the same for the tag form and for tags typed into a post. */
export const TAG_ALLOWANCE = { limit: 20, windowMs: 10 * 60_000 } as const;

/**
 * Spends `count` tag creations from a person's allowance. Tags are shared and permanent, so writing a
 * post must not be a way round the limit that the tag form has: a post can create up to 5 at once.
 * Nothing is spent beyond the limit; when it is hit, `retryAfter` says how many seconds to wait.
 */
export async function chargeNewTags(userId: string, count: number): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  for (let spent = 0; spent < count; spent++) {
    const result = await rateLimit(`tag:${userId}`, TAG_ALLOWANCE.limit, TAG_ALLOWANCE.windowMs);
    if (!result.ok) return { ok: false, retryAfter: result.retryAfter };
  }
  return { ok: true };
}
