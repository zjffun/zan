"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { PlayerHandle } from "./types";

interface YTPlayer {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: { onReady?: () => void; onError?: () => void };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads the official IFrame Player API once per page. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise<YTNamespace>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (window.YT) resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        reject(new Error("YouTube IFrame API failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

/**
 * Official YouTube embed on the privacy-friendly youtube-nocookie.com domain,
 * driven through the IFrame Player API so that "record current time" and
 * "click a timestamp to jump" work.
 */
export function YouTubePlayer({
  videoId,
  startAt,
  handleRef,
  onFail,
}: {
  videoId: string;
  startAt?: number;
  handleRef?: Ref<PlayerHandle>;
  /** The embed or the API could not load: the parent shows the fallback link. */
  onFail?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pendingSeek = useRef<number | null>(startAt ?? null);
  const [loading, setLoading] = useState(true);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onFailRef.current = onFail;
  });

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | undefined;
    const host = hostRef.current;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host) return;
        const mount = document.createElement("div");
        host.appendChild(mount);
        player = new YT.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            enablejsapi: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled || !player) return;
              playerRef.current = player;
              setLoading(false);
              if (pendingSeek.current !== null) {
                player.seekTo(pendingSeek.current, true);
                pendingSeek.current = null;
              }
            },
            onError: () => onFailRef.current?.(),
          },
        });
      })
      .catch(() => onFailRef.current?.());

    return () => {
      cancelled = true;
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        /* the iframe may already be gone */
      }
      if (host) host.replaceChildren();
    };
  }, [videoId]);

  useImperativeHandle(
    handleRef,
    () => ({
      getCurrentTime: () => {
        const player = playerRef.current;
        if (!player) return null;
        const t = player.getCurrentTime();
        return Number.isFinite(t) ? Math.floor(t) : null;
      },
      seekTo: (seconds: number) => {
        const player = playerRef.current;
        if (!player) {
          pendingSeek.current = seconds;
          return;
        }
        player.seekTo(seconds, true);
        player.playVideo();
      },
    }),
    [],
  );

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/70">
          正在加载播放器…
        </div>
      ) : null}
    </div>
  );
}
