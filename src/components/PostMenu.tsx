"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePost } from "@/app/actions/posts";

/** The author's own controls for a post: edit and delete. */
export function PostMenu({ postId }: { postId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("删除这条内容？评论和点赞也会一起删除，此操作无法撤销。")) return;
    setBusy(true);
    setError(null);
    const result = await deletePost(postId);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-3 text-sm">
      <Link href={`/p/${postId}/edit`} className="text-muted underline-offset-2 hover:text-ink hover:underline">
        编辑
      </Link>
      <button type="button" className="text-muted underline-offset-2 hover:text-danger hover:underline" onClick={remove} disabled={busy}>
        {busy ? "删除中…" : "删除"}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
