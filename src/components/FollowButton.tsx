"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFollow } from "@/app/actions/tags";
import { attempt } from "@/lib/attempt";

/** Follow / unfollow a tag. Visitors are sent to the login page first. */
export function FollowButton({ tagId, following, signedIn }: { tagId: string; following: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(following);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await attempt(() => setFollow(tagId, next));
      if (!result.ok) {
        setValue(!next);
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" onClick={toggle} disabled={pending} aria-pressed={value} className={value ? "btn" : "btn btn-primary"}>
        {value ? "已关注" : "关注"}
      </button>
      {error ? <span className="mt-1 text-xs text-danger">{error}</span> : null}
    </span>
  );
}
