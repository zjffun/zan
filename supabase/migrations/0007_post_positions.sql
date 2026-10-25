-- A post can point at several positions (12:34, p.132, E5 12:34 …), each with a short description.
--
-- posts.anchor (one position, with an optional "quote") is replaced by posts.anchors, an array of
-- positions:  [{"t":754,"note":"开场"}, {"t":2150,"t_end":2190,"note":"伏笔回收"}, {"page":132,"note":"…"}]
-- "note" is the old "quote": a short text of the author's own (200 characters at most, so that a
-- note stays a remark or a citation and is never a reproduction).
--
-- This migration only ADDS. The old column stays, and is still read when a post has no anchors, so
-- the application can be deployed before or after it, and an older deployment keeps working. The
-- new code writes anchors and clears anchor. A later migration can drop the old column.

alter table public.posts
  add column anchors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(anchors) = 'array'
           and jsonb_array_length(anchors) <= 20
           and pg_column_size(anchors) < 20000);

-- every position is an object, and its note is at most 200 characters (characters, not bytes)
create function public.anchors_are_valid(items jsonb)
returns boolean
language sql
immutable
as $$
  select not exists (
    select 1
    from jsonb_array_elements(items) as item
    where jsonb_typeof(item) <> 'object'
       or coalesce(char_length(item ->> 'note'), 0) > 200
  )
$$;

alter table public.posts add constraint posts_anchors_valid check (public.anchors_are_valid(anchors));

-- a post says something or points at something (positions count, as the old single anchor did)
alter table public.posts drop constraint posts_check;
alter table public.posts add constraint posts_check
  check (plain_text <> '' or source is not null or anchor is not null or jsonb_array_length(anchors) > 0);

-- carry over what exists: one position per post, its quote becomes its note.
-- (Not an edit by the author, so do not touch updated_at.)
alter table public.posts disable trigger posts_touch;
update public.posts
set anchors = jsonb_build_array(
  case when anchor ? 'quote'
       then (anchor - 'quote') || jsonb_build_object('note', anchor -> 'quote')
       else anchor
  end)
where anchor is not null;
alter table public.posts enable trigger posts_touch;

-- same rights as the other columns of a post: its author writes them, nobody else
grant insert (anchors) on public.posts to authenticated;
grant update (anchors) on public.posts to authenticated;
