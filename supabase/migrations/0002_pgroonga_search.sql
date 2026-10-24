-- Optional: Chinese / Japanese aware, typo-tolerant search with PGroonga.
--
-- Postgres' built-in full text search only tokenises space-separated languages,
-- so CJK notes need PGroonga. On Supabase: Database -> Extensions -> pgroonga
-- (or run the statement below). Skip this migration if you do not need it; the
-- ILIKE implementation from 0001 keeps working with the same signature.
--
-- NOTE: not exercised by scripts/test-db.sh unless WITH_PGROONGA=1 is set on a
-- server that has the extension installed.

create extension if not exists pgroonga with schema extensions;

create index if not exists notes_plain_text_pgroonga
  on public.notes using pgroonga (plain_text);

create index if not exists works_title_pgroonga
  on public.works using pgroonga (title);

-- Same signature as 0001, so the app does not care which one is installed.
-- `&@~` takes PGroonga's query syntax: `a b` is AND, `a OR b`, `-x` excludes.
create or replace function public.search_notes(q text, lim int default 30)
returns table (
  note_id uuid, jar_id uuid, source_id uuid, anchor jsonb,
  plain_text text, work_title text, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = 'public', 'extensions'
as $$
  select n.id, n.jar_id, n.source_id, n.anchor, n.plain_text, w.title, n.updated_at
  from public.notes n
  join public.jars j  on j.id = n.jar_id
  join public.works w on w.id = j.work_id
  where char_length(trim(q)) > 0
    and (n.plain_text &@~ trim(q) or w.title &@~ trim(q))
  order by n.updated_at desc
  limit least(greatest(lim, 1), 100)
$$;

revoke all on function public.search_notes(text, int) from public, anon;
grant execute on function public.search_notes(text, int) to authenticated;
