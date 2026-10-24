/* eslint-disable @next/next/no-img-element -- covers come from third-party hosts that block hotlinking */
import type { WorkKind } from "@/lib/types";
import { WORK_KIND_LABEL } from "@/lib/types";

/**
 * Cover art from Bangumi / Open Library / video CDNs. `referrerPolicy` is set
 * to no-referrer because several of them (Bilibili's hdslb.com) reject
 * hotlinking by Referer.
 */
export function Cover({
  src,
  kind,
  className = "h-24 w-16",
}: {
  src: string | null | undefined;
  kind: WorkKind;
  className?: string;
}) {
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${className} shrink-0 rounded-md border border-line bg-sunken object-cover`}
    />
  ) : (
    <div
      aria-hidden
      className={`${className} flex shrink-0 items-center justify-center rounded-md border border-line bg-sunken text-xs text-muted`}
    >
      {WORK_KIND_LABEL[kind]}
    </div>
  );
}
