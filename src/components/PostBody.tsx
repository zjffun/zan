"use client";

import { useRef } from "react";
import { anchorLabel, type Anchor } from "@/lib/anchor";
import type { ChipAttrs } from "@/lib/doc/schema";
import type { PostSource } from "@/lib/types";
import { SourcePlayer } from "./players/SourcePlayer";
import type { PlayerHandle } from "./players/types";
import { RichHtml } from "./RichHtml";

/** The post itself: its video or link, where in it the post is about, and the text. Time labels jump the player. */
export function PostBody({
  source,
  status,
  anchor,
  html,
}: {
  source: PostSource | null;
  status: "ok" | "dead";
  anchor: Anchor | null;
  /** rendered on the server from the whitelist */
  html: string;
}) {
  const playerRef = useRef<PlayerHandle>(null);

  function seek(attrs: ChipAttrs) {
    if (attrs.t !== undefined) playerRef.current?.seekTo(attrs.t);
  }

  return (
    <div className="space-y-4">
      {source ? <SourcePlayer source={{ ...source, status }} startAt={anchor?.t} handleRef={playerRef} /> : null}

      {anchor ? (
        <div className="space-y-2">
          {anchor.t !== undefined && source ? (
            <button type="button" className="anchor-chip !m-0" title="跳到这里" onClick={() => seek({ t: anchor.t })}>
              {anchorLabel(anchor)}
            </button>
          ) : (
            <span className="anchor-chip !m-0 !cursor-default">{anchorLabel(anchor)}</span>
          )}
          {anchor.quote ? (
            <blockquote className="border-l-[3px] border-line pl-3 text-sm italic text-muted">{anchor.quote}</blockquote>
          ) : null}
        </div>
      ) : null}

      <RichHtml html={html} onChip={seek} />
    </div>
  );
}
