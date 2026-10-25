"use client";

import { createContext, useCallback, useContext, useRef, type ReactNode, type RefObject } from "react";
import type { ChipAttrs } from "@/lib/doc/schema";
import type { PlayerHandle } from "./types";

const PlayerContext = createContext<RefObject<PlayerHandle | null> | null>(null);

/** Lets the comments reach the post's player: a time label in a comment jumps the same video as one in the post. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<PlayerHandle>(null);
  return <PlayerContext value={ref}>{children}</PlayerContext>;
}

/** Id of the element that holds the player, so that a jump from far down the page can bring it into view. */
export const PLAYER_ELEMENT_ID = "post-player";

/**
 * `ref` goes to the player (the one shared under a PlayerProvider, else one of its own); `seek` jumps it
 * to the time of a label, and scrolls it into view when the label was clicked far from it.
 */
export function usePlayer() {
  const shared = useContext(PlayerContext);
  const own = useRef<PlayerHandle>(null);
  const ref = shared ?? own;
  const seek = useCallback(
    (attrs: ChipAttrs) => {
      if (attrs.t === undefined) return;
      ref.current?.seekTo(attrs.t);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(PLAYER_ELEMENT_ID)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    },
    [ref],
  );
  return { ref, seek };
}
