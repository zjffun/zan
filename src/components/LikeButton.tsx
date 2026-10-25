"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLike } from "@/app/actions/social";
import { attempt } from "@/lib/attempt";
import { HeartIcon } from "./icons";

/** A heart with a count: optimistic, and sends visitors to the login page first. */
export function LikeButton({
  postId,
  count,
  liked,
  signedIn,
  className = "",
}: {
  postId: string;
  count: number;
  liked: boolean;
  signedIn: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState({ liked, count });
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const previous = state;
    const next = { liked: !state.liked, count: Math.max(0, state.count + (state.liked ? -1 : 1)) };
    setState(next);
    startTransition(async () => {
      const result = await attempt(() => setLike(postId, next.liked));
      if (result.ok) setState({ liked: next.liked, count: result.likeCount });
      else setState(previous);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={state.liked}
      aria-label={`${state.liked ? "取消点赞" : "点赞"}${state.count > 0 ? `（${state.count}）` : ""}`}
      className={`tap inline-flex items-center gap-1 text-sm tabular-nums transition-colors hover:text-accent ${state.liked ? "text-accent" : "text-muted"} ${className}`}
    >
      <HeartIcon filled={state.liked} className="size-4" />
      {state.count > 0 ? state.count : "赞"}
    </button>
  );
}
