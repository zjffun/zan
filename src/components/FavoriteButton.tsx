"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFavorite } from "@/app/actions/social";
import { attempt } from "@/lib/attempt";
import { BookmarkIcon } from "./icons";

/** Bookmark a post into "我的收藏". Visitors are sent to the login page first. */
export function FavoriteButton({ postId, favorited, signedIn }: { postId: string; favorited: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(favorited);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !value;
    setValue(next);
    startTransition(async () => {
      const result = await attempt(() => setFavorite(postId, next));
      if (!result.ok) setValue(!next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={value}
      className={`tap inline-flex items-center gap-1 text-sm transition-colors hover:text-accent ${value ? "text-accent" : "text-muted"}`}
    >
      <BookmarkIcon filled={value} className="size-4" />
      {value ? "已收藏" : "收藏"}
    </button>
  );
}
