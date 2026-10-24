"use client";

import { useImperativeHandle, useState, type Ref } from "react";
import type { PlayerHandle } from "./types";

/**
 * Bilibili's embedded player has no public JS API, so we can neither read its
 * time nor seek it. "Jump to 12:34" therefore reloads the iframe with a new
 * `t` parameter: a little less smooth, a lot more stable than hacking the
 * player script. Autoplay is off until the user has clicked a timestamp.
 */
export function BilibiliPlayer({
  bvid,
  p,
  startAt,
  handleRef,
}: {
  bvid: string;
  p: number;
  startAt?: number;
  handleRef?: Ref<PlayerHandle>;
}) {
  const [{ t, autoplay, nonce }, setState] = useState({ t: startAt ?? 0, autoplay: 0, nonce: 0 });

  useImperativeHandle(
    handleRef,
    () => ({
      getCurrentTime: () => null,
      seekTo: (seconds: number) => setState((s) => ({ t: seconds, autoplay: 1, nonce: s.nonce + 1 })),
    }),
    [],
  );

  const params = new URLSearchParams({
    isOutside: "true",
    bvid,
    p: String(p),
    autoplay: String(autoplay),
    high_quality: "1",
    danmaku: "0",
    ...(t > 0 ? { t: String(t) } : {}),
  });

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe
        key={nonce}
        title="哔哩哔哩播放器"
        src={`https://player.bilibili.com/player.html?${params}`}
        className="absolute inset-0 h-full w-full"
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
      />
    </div>
  );
}
