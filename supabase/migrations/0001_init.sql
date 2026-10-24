-- Zan — initial schema.
--
-- Principle: store references, not content. Works, source ids, timestamps,
-- page numbers and the user's own notes. Never video files or book text.
--
-- Everything the user writes (jars, sources, notes) is private by default and
-- guarded by row level security. The public site reads *snapshots* of a jar
-- through two narrow security-definer functions, never the private tables.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- works: shared catalog, deduplicated by external ids
-- ---------------------------------------------------------------------------

create table public.works (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('anime', 'book', 'manga', 'game', 'film', 'other')),
  title          text not null check (char_length(title) between 1 and 300),
  title_original text check (title_original is null or char_length(title_original) <= 300),
  cover_url      text check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 1000)),
  -- {"bangumi": "12", "isbn": "978...", "openlibrary": "OL45883W"}
  external       jsonb not null default '{}' check (jsonb_typeof(external) = 'object'),
  created_by     uuid references auth.users on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);

create unique index works_bangumi_uniq     on public.works ((external ->> 'bangumi'));
create unique index works_openlibrary_uniq on public.works ((external ->> 'openlibrary'));

-- ---------------------------------------------------------------------------
-- jars: one user's research space for one work
-- ---------------------------------------------------------------------------

create table public.jars (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users on delete cascade,
  work_id    uuid not null references public.works,
  -- random, unguessable: unlisted pages are only reachable by knowing it
  slug       text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
             check (slug ~ '^[a-z0-9]{8,32}$'),
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, work_id)
);

create index jars_owner_idx on public.jars (owner, updated_at desc);

create trigger jars_touch before update on public.jars
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- sources: videos / episodes / book editions attached to a jar
-- ---------------------------------------------------------------------------

create table public.sources (
  id         uuid primary key default gen_random_uuid(),
  jar_id     uuid not null references public.jars on delete cascade,
  provider   text not null check (provider in ('youtube', 'bilibili', 'episode', 'book', 'link')),
  -- {"videoId":"..."} / {"bvid":"BV...","p":2} / {"bgm_ep":123,"ep":5} / {"url":"https://..."}
  ref        jsonb not null check (jsonb_typeof(ref) = 'object'),
  -- snapshot of title / author / duration / thumbnail so notes stay readable if the video dies
  meta       jsonb check (meta is null or jsonb_typeof(meta) = 'object'),
  status     text not null default 'ok' check (status in ('ok', 'dead')),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, jar_id),
  unique (jar_id, provider, ref)
);

create index sources_jar_idx on public.sources (jar_id, created_at);

-- ---------------------------------------------------------------------------
-- notes: body (TipTap JSON) + anchor
-- ---------------------------------------------------------------------------

create table public.notes (
  id              uuid primary key default gen_random_uuid(),
  jar_id          uuid not null references public.jars on delete cascade,
  source_id       uuid,
  -- {"t":754,"t_end":760} | {"page":132,"quote":"..."} | {"ep":5,"t":754}
  anchor          jsonb check (
                    anchor is null
                    or (jsonb_typeof(anchor) = 'object'
                        -- a quote is a citation, not a reproduction
                        and coalesce(char_length(anchor ->> 'quote'), 0) <= 200)
                  ),
  body            jsonb not null check (pg_column_size(body) < 200000),
  plain_text      text not null default '' check (char_length(plain_text) <= 50000),
  hide_on_publish boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- a note can only point at a source of its own jar; deleting the source keeps the note
  foreign key (source_id, jar_id) references public.sources (id, jar_id) on delete set null (source_id)
);

create index notes_jar_idx on public.notes (jar_id, created_at);

create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- Touching notes or sources makes the jar "recently used" in the jar list.
-- (The dead-link checker only updates sources.status/checked_at, which does not fire this.)
create or replace function public.bump_jar_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.jars set updated_at = now() where id = coalesce(new.jar_id, old.jar_id);
  return null;
end;
$$;

create trigger notes_bump_jar after insert or update or delete on public.notes
  for each row execute function public.bump_jar_updated();
create trigger sources_bump_jar after insert or delete on public.sources
  for each row execute function public.bump_jar_updated();

-- ---------------------------------------------------------------------------
-- publications: immutable-ish snapshot the public site reads
-- ---------------------------------------------------------------------------

create table public.publications (
  jar_id       uuid primary key references public.jars on delete cascade,
  slug         text not null unique,
  visibility   text not null check (visibility in ('unlisted', 'public')),
  title        text not null,
  version      int not null default 1,
  snapshot     jsonb not null check (pg_column_size(snapshot) < 5000000),
  published_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.works        enable row level security;
alter table public.jars         enable row level security;
alter table public.sources      enable row level security;
alter table public.notes        enable row level security;
alter table public.publications enable row level security;

-- works: any signed-in user can read the shared catalog and add entries; nobody edits them
create policy works_read   on public.works for select to authenticated using (true);
create policy works_insert on public.works for insert to authenticated
  with check (created_by = auth.uid());

-- jars: owner only
create policy jars_owner on public.jars for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- sources / notes: through the owning jar
create policy sources_owner on public.sources for all to authenticated
  using (exists (select 1 from public.jars j where j.id = sources.jar_id and j.owner = auth.uid()))
  with check (exists (select 1 from public.jars j where j.id = sources.jar_id and j.owner = auth.uid()));

create policy notes_owner on public.notes for all to authenticated
  using (exists (select 1 from public.jars j where j.id = notes.jar_id and j.owner = auth.uid()))
  with check (exists (select 1 from public.jars j where j.id = notes.jar_id and j.owner = auth.uid()));

-- publications: the owner may look at (and, via unpublish_jar, delete) their own snapshot.
-- Nobody writes it directly: it is only produced by publish_jar() below.
create policy publications_owner_read on public.publications for select to authenticated
  using (exists (select 1 from public.jars j where j.id = publications.jar_id and j.owner = auth.uid()));
create policy publications_owner_delete on public.publications for delete to authenticated
  using (exists (select 1 from public.jars j where j.id = publications.jar_id and j.owner = auth.uid()));

-- explicit grants: do not depend on the platform's default privileges
grant usage on schema public to anon, authenticated;
revoke all on public.works, public.jars, public.sources, public.notes, public.publications from anon;
grant select, insert                  on public.works        to authenticated;
grant select, insert, update, delete  on public.jars         to authenticated;
grant select, insert, update, delete  on public.sources      to authenticated;
grant select, insert, update, delete  on public.notes        to authenticated;
grant select, delete                  on public.publications to authenticated;

-- ---------------------------------------------------------------------------
-- publish / unpublish: a snapshot, not a status flip
-- ---------------------------------------------------------------------------

create or replace function public.publish_jar(p_jar_id uuid, p_visibility text)
returns table (slug text, visibility text, version int, published_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_jar      public.jars;
  v_work     public.works;
  v_snapshot jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_visibility not in ('unlisted', 'public') then
    raise exception 'visibility must be unlisted or public' using errcode = '22023';
  end if;

  select * into v_jar from public.jars j where j.id = p_jar_id and j.owner = v_uid;
  if not found then
    raise exception 'jar not found' using errcode = 'P0002';
  end if;
  select * into v_work from public.works w where w.id = v_jar.work_id;

  v_snapshot := jsonb_build_object(
    'schema', 1,
    'work', jsonb_build_object(
      'kind', v_work.kind,
      'title', v_work.title,
      'title_original', v_work.title_original,
      'cover_url', v_work.cover_url,
      'external', v_work.external
    ),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'provider', s.provider, 'ref', s.ref, 'meta', s.meta, 'status', s.status
      ) order by s.created_at)
      from public.sources s where s.jar_id = v_jar.id
    ), '[]'::jsonb),
    -- notes marked hide_on_publish never leave the private tables
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'source_id', n.source_id, 'anchor', n.anchor, 'body', n.body, 'updated_at', n.updated_at
      ) order by n.created_at)
      from public.notes n where n.jar_id = v_jar.id and not n.hide_on_publish
    ), '[]'::jsonb)
  );

  update public.jars set visibility = p_visibility where id = v_jar.id;

  return query
  insert into public.publications as p (jar_id, slug, visibility, title, snapshot)
  values (v_jar.id, v_jar.slug, p_visibility, v_work.title, v_snapshot)
  on conflict (jar_id) do update
    set visibility   = excluded.visibility,
        title        = excluded.title,
        snapshot     = excluded.snapshot,
        version      = p.version + 1,
        published_at = now()
  returning p.slug, p.visibility, p.version, p.published_at;
end;
$$;

create or replace function public.unpublish_jar(p_jar_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.publications where jar_id = p_jar_id;
  update public.jars set visibility = 'private' where id = p_jar_id;
end;
$$;

revoke all on function public.publish_jar(uuid, text)  from public, anon;
revoke all on function public.unpublish_jar(uuid)      from public, anon;
grant execute on function public.publish_jar(uuid, text) to authenticated;
grant execute on function public.unpublish_jar(uuid)     to authenticated;

-- ---------------------------------------------------------------------------
-- public reads: by slug only. `unlisted` stays unlisted because the table
-- itself is not readable by anon and the list function skips unlisted rows.
-- ---------------------------------------------------------------------------

create or replace function public.get_publication(p_slug text)
returns table (slug text, visibility text, version int, snapshot jsonb, published_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.slug, p.visibility, p.version, p.snapshot, p.published_at
  from public.publications p
  where p.slug = p_slug
$$;

create or replace function public.list_public_publications()
returns table (slug text, title text, published_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.slug, p.title, p.published_at
  from public.publications p
  where p.visibility = 'public'
  order by p.published_at desc
  limit 5000
$$;

revoke all on function public.get_publication(text)         from public;
revoke all on function public.list_public_publications()    from public;
grant execute on function public.get_publication(text)      to anon, authenticated;
grant execute on function public.list_public_publications() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- note search (RLS applies: security invoker). Plain ILIKE here works anywhere;
-- 0002_pgroonga_search.sql swaps in a PGroonga implementation for CJK-aware,
-- typo-tolerant search with the same signature.
-- ---------------------------------------------------------------------------

create or replace function public.search_notes(q text, lim int default 30)
returns table (
  note_id uuid, jar_id uuid, source_id uuid, anchor jsonb,
  plain_text text, work_title text, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.id, n.jar_id, n.source_id, n.anchor, n.plain_text, w.title, n.updated_at
  from public.notes n
  join public.jars j  on j.id = n.jar_id
  join public.works w on w.id = j.work_id
  where char_length(trim(q)) > 0
    and (
      n.plain_text ilike '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or w.title   ilike '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by n.updated_at desc
  limit least(greatest(lim, 1), 100)
$$;

revoke all on function public.search_notes(text, int) from public, anon;
grant execute on function public.search_notes(text, int) to authenticated;
