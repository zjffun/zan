"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatRelative } from "@/lib/time";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

/** One clock for every time on the page: it ticks once a minute, and only while some time is showing. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach((notify) => notify()), 60_000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * "3 小时前". The server (and the first paint in the browser) says the date: a cached page cannot know how
 * long ago it will be read, and the two must agree for hydration. The browser then switches to the
 * relative form and keeps it fresh.
 */
export function RelativeTime({ iso, className, title }: { iso: string; className?: string; title?: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatRelative(iso, Date.now()),
    () => formatDate(iso),
  );
  return (
    <time className={className} dateTime={iso} title={title}>
      {label}
    </time>
  );
}
