"use client";

import { useState, type Ref } from "react";
import { sourceUrl } from "@/lib/sources";
import { BilibiliPlayer } from "./BilibiliPlayer";
import { Placeholder } from "./Placeholder";
import type { PlayerHandle, PlayerSource } from "./types";
import { YouTubePlayer } from "./YouTubePlayer";

/**
 * Shows the right player for a source, plus the "open on the original site"
 * link that every player needs: mainland-China visitors cannot load YouTube
 * embeds, and some Bilibili videos refuse to play abroad.
 */
export function SourcePlayer({
  source,
  startAt,
  handleRef,
}: {
  source: PlayerSource;
  startAt?: number;
  handleRef?: Ref<PlayerHandle>;
}) {
  const [failed, setFailed] = useState(false);
  const url = sourceUrl(source, startAt);

  let player;
  if (source.status === "dead") {
    player = <Placeholder source={source} reason="dead" />;
  } else if (failed) {
    player = <Placeholder source={source} reason="failed" />;
  } else if (source.provider === "youtube" && typeof source.ref.videoId === "string") {
    player = <YouTubePlayer videoId={source.ref.videoId} startAt={startAt} handleRef={handleRef} onFail={() => setFailed(true)} />;
  } else if (source.provider === "bilibili" && typeof source.ref.bvid === "string") {
    player = (
      <BilibiliPlayer
        bvid={source.ref.bvid}
        p={typeof source.ref.p === "number" ? source.ref.p : 1}
        startAt={startAt}
        handleRef={handleRef}
      />
    );
  } else {
    player = <Placeholder source={source} reason="external" />;
  }

  const showOriginLink = url && (source.provider === "youtube" || source.provider === "bilibili") && source.status !== "dead";
  return (
    <div>
      {player}
      {showOriginLink ? (
        <p className="mt-2 text-xs text-muted">
          看不了？{" "}
          <a className="underline underline-offset-2" href={url} target="_blank" rel="noopener noreferrer nofollow">
            在原站打开 ↗
          </a>
        </p>
      ) : null}
    </div>
  );
}
