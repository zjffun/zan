"use client";

import { anchorLabel, type Anchor } from "@/lib/anchor";
import { canSeek } from "@/lib/sources";
import { formatTimestamp } from "@/lib/time";
import type { PostSource } from "@/lib/types";
import { SourcePlayer } from "./players/SourcePlayer";
import { PLAYER_ELEMENT_ID, usePlayer } from "./players/player-context";
import { RichHtml } from "./RichHtml";

/** The post itself: its video or link, the positions it points at with their descriptions, and the text. Time labels jump the player. */
export function PostBody({
  source,
  status,
  anchors,
  startAt,
  html,
}: {
  source: PostSource | null;
  status: "ok" | "dead";
  /** positions kept in a list of their own: only on posts from before the editor dropped that list */
  anchors: Anchor[];
  /** where the player starts: the first time the post mentions */
  startAt?: number;
  /** rendered on the server from the whitelist */
  html: string;
}) {
  const { ref: playerRef, seek } = usePlayer();
  const seekable = canSeek(source, status);

  return (
    <div className="space-y-4">
      {source ? (
        <div id={PLAYER_ELEMENT_ID}>
          <SourcePlayer source={{ ...source, status }} startAt={startAt} handleRef={playerRef} />
        </div>
      ) : null}

      {anchors.length > 0 ? (
        <ul className="space-y-2">
          {anchors.map((anchor, index) => (
            <li key={index} className="flex items-baseline gap-2">
              {anchor.t !== undefined && seekable ? (
                <button
                  type="button"
                  className="anchor-chip anchor-chip--seek !m-0 shrink-0"
                  title={`跳到 ${formatTimestamp(anchor.t)}`}
                  onClick={() => seek({ t: anchor.t })}
                >
                  {anchorLabel(anchor)}
                </button>
              ) : anchor.t !== undefined ? (
                <span className="anchor-chip anchor-chip--static !m-0 shrink-0">{anchorLabel(anchor)}</span>
              ) : (
                // a page, an episode, a chapter: not a label, only words
                <span className="shrink-0 text-sm font-medium tabular-nums text-muted">{anchorLabel(anchor)}</span>
              )}
              {anchor.note ? <span className="min-w-0 whitespace-pre-line break-words text-sm">{anchor.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <RichHtml html={html} onChip={seek} />
    </div>
  );
}
