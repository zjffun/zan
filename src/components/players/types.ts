import type { PostSource } from "@/lib/types";

/** What the page can ask of whichever player is showing. */
export interface PlayerHandle {
  /** Whole seconds, or null when this player cannot report its time (Bilibili, placeholders). */
  getCurrentTime(): number | null;
  /** Jump (and play). Players that cannot seek ignore it. */
  seekTo(seconds: number): void;
}

export type PlayerSource = PostSource & { status: "ok" | "dead" };
