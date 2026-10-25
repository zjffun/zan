-- "已编辑" must mean the author edited the post.
--
-- posts.updated_at moved on EVERY update except a change of the like/comment counters. The daily
-- source check updates source_status / source_fail_count / source_checked_at, so after the first
-- run every video post looked edited (the post page prints "已编辑" when updated_at is more than a
-- minute after created_at). Now it moves only when something the author can change has changed:
-- the text, the video or link, the positions, or who can see it. Saving without a change, the source
-- check, a takedown and the counters leave it alone.
--
-- Posts that the check has already touched keep the updated_at it gave them: there is no telling
-- those apart from real edits.

drop trigger posts_touch on public.posts;

create trigger posts_touch before update on public.posts
  for each row
  when (
    old.body is distinct from new.body
    or old.plain_text is distinct from new.plain_text
    or old.source is distinct from new.source
    or old.anchor is distinct from new.anchor
    or old.anchors is distinct from new.anchors
    or old.visibility is distinct from new.visibility
  )
  execute function public.touch_updated_at();
