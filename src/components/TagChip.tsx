import Link from "next/link";
import type { TagRef } from "@/lib/types";

/** A tag as a link to its page. */
export function TagChip({ tag, className = "" }: { tag: Pick<TagRef, "slug" | "name">; className?: string }) {
  return (
    <Link
      href={`/t/${tag.slug}`}
      className={`chip hover:!bg-accent-soft hover:!text-accent ${className}`}
    >
      <span aria-hidden>#</span>
      {tag.name}
    </Link>
  );
}
