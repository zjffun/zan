import "server-only";
import { rateLimit, type RateLimitResult } from "./ratelimit";

export interface Policy {
  /** names the counter: two policies must never share one, or one kind of action eats the other's allowance */
  readonly key: string;
  readonly limit: number;
  readonly windowMs: number;
}

const minute = 60_000;
const tenMinutes = 10 * minute;
const day = 24 * 60 * minute;

/**
 * Every rate limit of the site, in one place. Who is counted is said at the call site: a signed-in
 * person's id, or (before anybody is signed in) the address the request came from.
 */
export const LIMITS = {
  // signing in and out of the way: per address
  signIn: { key: "auth", limit: 20, windowMs: tenMinutes },
  siteSearch: { key: "site-search", limit: 60, windowMs: minute },

  // writing: per person
  postCreate: { key: "post", limit: 20, windowMs: tenMinutes },
  postEdit: { key: "post-edit", limit: 60, windowMs: tenMinutes },
  postDelete: { key: "post-delete", limit: 30, windowMs: tenMinutes },
  comment: { key: "comment", limit: 20, windowMs: tenMinutes },
  commentDelete: { key: "comment-delete", limit: 60, windowMs: tenMinutes },
  profileEdit: { key: "profile", limit: 10, windowMs: tenMinutes },
  /** tags are shared and permanent: one allowance for the tag form, the work search's "create" and tags typed into a post */
  tagCreate: { key: "tag", limit: 20, windowMs: tenMinutes },
  uploadBurst: { key: "upload-min", limit: 12, windowMs: minute },
  uploadDaily: { key: "upload-day", limit: 60, windowMs: day },

  // small actions and lookups: per person
  mark: { key: "mark", limit: 120, windowMs: minute },
  follow: { key: "follow", limit: 60, windowMs: minute },
  tagSearch: { key: "tagsearch", limit: 120, windowMs: minute },
  workSearch: { key: "search", limit: 30, windowMs: minute },
  resolveLink: { key: "resolve", limit: 30, windowMs: minute },
  /** reads up to 5000 posts */
  exportAll: { key: "export", limit: 5, windowMs: tenMinutes },
} as const satisfies Record<string, Policy>;

/** Counts one use of `policy` by `who`. */
export function enforce(policy: Policy, who: string): Promise<RateLimitResult> {
  return rateLimit(`${policy.key}:${who}`, policy.limit, policy.windowMs);
}
