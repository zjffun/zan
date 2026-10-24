/* eslint-disable @next/next/no-img-element -- covers come from third-party hosts that block hotlinking */
import { TAG_KIND_LABEL, type TagKind } from "@/lib/types";

/**
 * Cover art from Bangumi / Open Library / video CDNs. `referrerPolicy` is set
 * to no-referrer because several of them (Bilibili's hdslb.com) reject
 * hotlinking by Referer.
 */
export function Cover({
  src,
  kind,
  label,
  className = "h-24 w-16",
}: {
  src: string | null | undefined;
  kind: TagKind | null;
  /** shown on the placeholder instead of the kind, e.g. the first letter of a tag's name */
  label?: string;
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
      {label ?? (kind ? TAG_KIND_LABEL[kind] : "#")}
    </div>
  );
}
