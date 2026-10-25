"use client";

import type { PostSource } from "@/lib/types";
import { SourcePlayer } from "./players/SourcePlayer";
import { PLAYER_ELEMENT_ID, usePlayer } from "./players/player-context";
import { RichHtml } from "./RichHtml";

/** The post itself: its video or link and the text. Time labels jump the player. */
export function PostBody({
  source,
  status,
  startAt,
  html,
}: {
  source: PostSource | null;
  status: "ok" | "dead";
  /** where the player starts: the first time the post mentions */
  startAt?: number;
  /** rendered on the server from the whitelist */
  html: string;
}) {
  const { ref: playerRef, seek } = usePlayer();

  return (
    <div className="space-y-4">
      {source ? (
        <div id={PLAYER_ELEMENT_ID}>
          <SourcePlayer source={{ ...source, status }} startAt={startAt} handleRef={playerRef} />
        </div>
      ) : null}

      <RichHtml html={html} onChip={seek} />
    </div>
  );
}
