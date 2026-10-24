import { getCurrentUser } from "@/lib/dal";
import { getViewerState } from "@/lib/posts";
import type { PostCardData } from "@/lib/types";
import { PostCard } from "./PostCard";

/** Cards in a masonry-style column layout. Looks up which of them the viewer has liked. Reads cookies: render inside <Suspense>. */
export async function PostList({ items }: { items: PostCardData[] }) {
  const user = await getCurrentUser();
  const state = await getViewerState(
    items.map((post) => post.id),
    user?.id ?? null,
  );
  const liked = new Set(state.liked);
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
      {items.map((post) => (
        <PostCard key={post.id} post={post} liked={liked.has(post.id)} signedIn={Boolean(user)} />
      ))}
    </div>
  );
}
