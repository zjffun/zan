-- Zan — the public feed on the home page.
--
-- Like get_publication() / list_public_publications() this is a narrow
-- security-definer read over `publications`: it only ever returns `public`
-- snapshots (never `unlisted` ones) and only the handful of fields a feed card
-- needs, so the page does not have to pull whole snapshots just to list them.

create or replace function public.list_public_feed(
  p_kind   text default null,
  p_limit  int  default 20,
  p_offset int  default 0
)
returns table (
  slug         text,
  kind         text,
  title        text,
  title_original text,
  cover_url    text,
  note_count   int,
  source_count int,
  -- body of the first note that has any content (TipTap JSON; sanitize before use)
  first_note   jsonb,
  version      int,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.slug,
    p.snapshot -> 'work' ->> 'kind',
    p.title,
    p.snapshot -> 'work' ->> 'title_original',
    p.snapshot -> 'work' ->> 'cover_url',
    jsonb_array_length(coalesce(p.snapshot -> 'notes', '[]'::jsonb)),
    jsonb_array_length(coalesce(p.snapshot -> 'sources', '[]'::jsonb)),
    (
      select n.note -> 'body'
      from jsonb_array_elements(coalesce(p.snapshot -> 'notes', '[]'::jsonb)) with ordinality as n(note, ord)
      where case
              when jsonb_typeof(n.note -> 'body' -> 'content') = 'array'
                then jsonb_array_length(n.note -> 'body' -> 'content') > 0
              else false
            end
      order by n.ord
      limit 1
    ),
    p.version,
    p.published_at
  from public.publications p
  where p.visibility = 'public'
    and (p_kind is null or p.snapshot -> 'work' ->> 'kind' = p_kind)
  order by p.published_at desc
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0)
$$;

revoke all on function public.list_public_feed(text, int, int) from public;
grant execute on function public.list_public_feed(text, int, int) to anon, authenticated;
