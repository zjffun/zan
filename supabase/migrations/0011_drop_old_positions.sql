-- The lists of positions (posts.anchors, and posts.anchor before it) are empty since the last
-- migration and nothing reads them any more: drop them, and what only existed for them.
--
-- Run this AFTER the application that no longer reads them is deployed (a deployment from before
-- that selects both columns, and would fail on every post while they are gone).

-- the trigger that keeps updated_at honest looked at both columns
drop trigger posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row
  when (
    old.body is distinct from new.body
    or old.plain_text is distinct from new.plain_text
    or old.source is distinct from new.source
    or old.visibility is distinct from new.visibility
  )
  execute function public.touch_updated_at();

-- a post says something or points at something
alter table public.posts drop constraint posts_check;
alter table public.posts add constraint posts_check check (plain_text <> '' or source is not null);

alter table public.posts drop column anchors;
alter table public.posts drop column anchor;
drop function public.anchors_are_valid(jsonb);
