-- Optional: Chinese / Japanese aware, typo-tolerant search with PGroonga.
--
-- Postgres' built-in full text search only tokenises space-separated languages,
-- so CJK posts need PGroonga. On Supabase: Database -> Extensions -> pgroonga
-- (or run the statement below). Skip this migration if you do not need it; the
-- ILIKE implementation from 0004 keeps working with the same signature.
--
-- NOTE: not exercised by scripts/test-db.sh unless WITH_PGROONGA=1 is set on a
-- server that has the extension installed.

create extension if not exists pgroonga with schema extensions;

create index if not exists posts_plain_text_pgroonga
  on public.posts using pgroonga (plain_text);

create index if not exists tags_name_pgroonga
  on public.tags using pgroonga (name);

-- Same signature as 0004, so the app does not care which one is installed.
-- `&@~` takes PGroonga's query syntax: `a b` is AND, `a OR b`, `-x` excludes.
create or replace function public.search_posts(q text, lim int default 30, off int default 0)
returns setof public.posts
language sql
stable
security invoker
set search_path = 'public', 'extensions'
as $$
  select p.*
  from public.posts p
  where char_length(btrim(q)) > 0
    and (
      p.plain_text &@~ btrim(q)
      or exists (
        select 1
        from public.post_tags pt
        join public.tags t on t.id = pt.tag_id
        where pt.post_id = p.id and t.name &@~ btrim(q)
      )
    )
  order by p.created_at desc
  limit least(greatest(lim, 1), 100)
  offset greatest(off, 0)
$$;

revoke all on function public.search_posts(text, int, int) from public;
grant execute on function public.search_posts(text, int, int) to anon, authenticated;
