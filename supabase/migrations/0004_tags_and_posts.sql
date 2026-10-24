-- Zan — tags and posts.
--
-- Replaces the "jar" model (a private research space per work, published as a
-- snapshot) with a community model:
--
--   tags      the "bars": anime, books, one work, any topic. Anyone can create one.
--   posts     one standalone piece of content: a note, optionally pointing at a
--             video or link, with an anchor (12:34, p.132 …), carrying 0–5 tags.
--   comments, likes, favorites, tag follows, and a public profile per author.
--
-- Still "store references, not content": a post keeps a source's ids and a
-- metadata snapshot, never video files or book text.
--
-- Reads are public by design (RLS lets `anon` see public posts); writes always
-- go through the signed-in user's own rows. Counters that other people's actions
-- change (likes, comments) are kept by security-definer triggers.

-- ---------------------------------------------------------------------------
-- the old model goes away
-- ---------------------------------------------------------------------------

drop function if exists public.search_notes(text, int);
drop function if exists public.list_public_feed(text, int, int);
drop function if exists public.list_public_publications();
drop function if exists public.get_publication(text);
drop function if exists public.unpublish_jar(uuid);
drop function if exists public.publish_jar(uuid, text);
drop table if exists public.publications, public.notes, public.sources, public.jars, public.works cascade;
drop function if exists public.bump_jar_updated();

-- ---------------------------------------------------------------------------
-- text hygiene: btrim() only strips ASCII spaces, which lets blank-looking
-- text through ("\n", an ideographic space U+3000, zero-width characters)
-- ---------------------------------------------------------------------------

create or replace function public.trim_blanks(t text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    t,
    '^[[:space:]\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]+|[[:space:]\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]+$',
    '',
    'g'
  )
$$;

-- ---------------------------------------------------------------------------
-- profiles: the public face of an account
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  nickname   text not null check (
               char_length(nickname) between 1 and 24
               and nickname = public.trim_blanks(nickname)
               and nickname !~ '[[:cntrl:]]'
             ),
  bio        text not null default '' check (char_length(bio) <= 200),
  created_at timestamptz not null default now()
);

create unique index profiles_nickname_key on public.profiles (lower(nickname));

-- Every account gets a profile with a generated nickname it can change later.
create or replace function public.default_nickname(p_id uuid, p_length int default 6)
returns text
language sql
immutable
as $$
  select '攒友' || substr(md5(p_id::text), 1, p_length)
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.profiles (id, nickname) values (new.id, public.default_nickname(new.id));
  exception when unique_violation then
    -- a nickname collision (or a re-run): try a longer suffix
    insert into public.profiles (id, nickname) values (new.id, public.default_nickname(new.id, 12))
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, nickname)
select u.id, public.default_nickname(u.id) from auth.users u
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  -- short and URL-safe: names can contain anything, so pages are addressed by slug
  slug        text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
              check (slug ~ '^[a-z0-9]{8,32}$'),
  name        text not null check (
                char_length(name) between 1 and 30
                and name = public.trim_blanks(name)
                and name !~ '[[:cntrl:]#]'
              ),
  -- what sort of thing the tag is about; null for plain topics
  kind        text check (kind in ('anime', 'book', 'manga', 'game', 'film', 'other')),
  description text not null default '' check (char_length(description) <= 300),
  cover_url   text check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 1000)),
  -- {"bangumi": "12", "openlibrary": "OL45883W", "isbn": "978..."} for tags made from a catalog entry
  external    jsonb not null default '{}' check (jsonb_typeof(external) = 'object'),
  created_by  uuid references auth.users on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create unique index tags_name_key        on public.tags (lower(name));
create unique index tags_bangumi_uniq     on public.tags ((external ->> 'bangumi'));
create unique index tags_openlibrary_uniq on public.tags ((external ->> 'openlibrary'));

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author        uuid not null default auth.uid() references public.profiles on delete cascade,
  -- TipTap JSON, always sanitized by the server before it is stored
  body          jsonb not null check (jsonb_typeof(body) = 'object' and pg_column_size(body) < 200000),
  plain_text    text not null default '' check (char_length(plain_text) <= 20000),
  -- what the post points at: {"provider":"youtube","ref":{"videoId":"…"},"meta":{"title":"…"}}
  source        jsonb check (source is null or jsonb_typeof(source) = 'object'),
  source_status text not null default 'ok' check (source_status in ('ok', 'dead')),
  -- consecutive "looks dead" answers from the checker; the status flips to dead at 2, because
  -- Bilibili sometimes answers blocked requests with a plausible -404
  source_fail_count smallint not null default 0 check (source_fail_count >= 0),
  source_checked_at timestamptz,
  -- {"t":754,"t_end":760} | {"page":132,"quote":"..."} | {"ep":5,"t":754}
  anchor        jsonb check (
                  anchor is null
                  or (jsonb_typeof(anchor) = 'object'
                      -- a quote is a citation, not a reproduction
                      and coalesce(char_length(anchor ->> 'quote'), 0) <= 200)
                ),
  visibility    text not null default 'public' check (visibility in ('public', 'private')),
  like_count    int not null default 0 check (like_count >= 0),
  comment_count int not null default 0 check (comment_count >= 0),
  -- set by an operator (takedown); a removed post is invisible to everybody
  removed_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- a post says something or points at something
  check (plain_text <> '' or source is not null or anchor is not null)
);

create index posts_public_idx on public.posts (created_at desc) where visibility = 'public' and removed_at is null;
create index posts_author_idx on public.posts (author, created_at desc);
create index posts_check_idx  on public.posts (source_checked_at nulls first) where source is not null;

-- editing only counts when the content changes, not when somebody likes the post
create trigger posts_touch before update on public.posts
  for each row
  when (old.like_count = new.like_count and old.comment_count = new.comment_count)
  execute function public.touch_updated_at();

-- pointing the post at a different source starts its health record over
create or replace function public.reset_source_health()
returns trigger
language plpgsql
as $$
begin
  if new.source is distinct from old.source then
    new.source_status := 'ok';
    new.source_fail_count := 0;
    new.source_checked_at := null;
  end if;
  return new;
end;
$$;

create trigger posts_reset_source_health before update of source on public.posts
  for each row execute function public.reset_source_health();

create table public.post_tags (
  post_id uuid not null references public.posts on delete cascade,
  tag_id  uuid not null references public.tags  on delete cascade,
  primary key (post_id, tag_id)
);

create index post_tags_tag_idx on public.post_tags (tag_id, post_id);

create or replace function public.limit_post_tags()
returns trigger
language plpgsql
as $$
begin
  -- two concurrent inserts for the same post must not both count 4 and pass
  perform pg_advisory_xact_lock(hashtextextended(new.post_id::text, 0));
  if (select count(*) from public.post_tags where post_id = new.post_id) >= 5 then
    raise exception 'a post can carry at most 5 tags' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger post_tags_limit before insert on public.post_tags
  for each row execute function public.limit_post_tags();

-- ---------------------------------------------------------------------------
-- comments (one level of replies), likes, favorites, tag follows
-- ---------------------------------------------------------------------------

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts on delete cascade,
  parent_id  uuid references public.comments on delete cascade,
  author     uuid not null default auth.uid() references public.profiles on delete cascade,
  body       text not null check (char_length(public.trim_blanks(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

-- a reply answers a top-level comment of the same post
create or replace function public.check_comment_parent()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments c
    where c.id = new.parent_id and c.post_id = new.post_id and c.parent_id is null
  ) then
    raise exception 'replies go to a top-level comment of the same post' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger comments_parent before insert on public.comments
  for each row execute function public.check_comment_parent();

create table public.likes (
  post_id    uuid not null references public.posts on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.favorites (
  post_id    uuid not null references public.posts on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index favorites_user_idx on public.favorites (user_id, created_at desc);

create table public.tag_follows (
  tag_id     uuid not null references public.tags on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tag_id, user_id)
);

create index tag_follows_user_idx on public.tag_follows (user_id);

-- Other people's likes and comments change a post they cannot update, so the
-- counters are maintained by definer triggers (never by the clients).
create or replace function public.bump_post_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta int := case tg_op when 'INSERT' then 1 else -1 end;
  target uuid := coalesce(new.post_id, old.post_id);
begin
  if tg_table_name = 'likes' then
    update public.posts set like_count = greatest(like_count + delta, 0) where id = target;
  else
    update public.posts set comment_count = greatest(comment_count + delta, 0) where id = target;
  end if;
  return null;
end;
$$;

create trigger likes_count    after insert or delete on public.likes
  for each row execute function public.bump_post_counter();
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_post_counter();

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.tags        enable row level security;
alter table public.posts       enable row level security;
alter table public.post_tags   enable row level security;
alter table public.comments    enable row level security;
alter table public.likes       enable row level security;
alter table public.favorites   enable row level security;
alter table public.tag_follows enable row level security;

-- profiles: public to read; you edit your own (the row itself is made by the signup trigger)
create policy profiles_read   on public.profiles for select to anon, authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- tags: public to read; any signed-in user may add one; its creator may edit the description and cover
create policy tags_read   on public.tags for select to anon, authenticated using (true);
create policy tags_insert on public.tags for insert to authenticated with check (created_by = auth.uid());
create policy tags_update on public.tags for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- posts: everybody sees public ones, the author also sees their private ones; nobody sees removed ones
create policy posts_read on public.posts for select to anon, authenticated
  using (removed_at is null and (visibility = 'public' or author = auth.uid()));
create policy posts_insert on public.posts for insert to authenticated with check (author = auth.uid());
create policy posts_update on public.posts for update to authenticated
  using (author = auth.uid() and removed_at is null) with check (author = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (author = auth.uid());

-- post_tags: visible with the post; only its author changes them
create policy post_tags_read on public.post_tags for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_tags_insert on public.post_tags for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid()));
create policy post_tags_delete on public.post_tags for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid()));

-- comments: visible with the post; anyone signed in can comment on a post they can see;
-- the comment's author or the post's author can delete it; nobody edits
create policy comments_read on public.comments for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy comments_delete on public.comments for delete to authenticated
  using (
    author = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
  );

-- likes, favorites, follows: your own rows, visible only to you (counts live on the post / tag)
create policy likes_own on public.likes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy favorites_own on public.favorites for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy tag_follows_own on public.tag_follows for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Explicit grants, down to the column: clients can never write counters, removed_at or health state.
grant usage on schema public to anon, authenticated;
revoke all on public.profiles, public.tags, public.posts, public.post_tags, public.comments,
              public.likes, public.favorites, public.tag_follows from anon, authenticated;

grant select on public.profiles, public.tags, public.posts, public.post_tags, public.comments to anon, authenticated;
grant select, insert, delete on public.likes, public.favorites, public.tag_follows to authenticated;
grant update (nickname, bio)                                 on public.profiles to authenticated;
grant insert (name, kind, description, cover_url, external)  on public.tags     to authenticated;
grant update (description, cover_url)                        on public.tags     to authenticated;
grant insert (body, plain_text, source, anchor, visibility)  on public.posts    to authenticated;
grant update (body, plain_text, source, anchor, visibility)  on public.posts    to authenticated;
grant delete                                                 on public.posts    to authenticated;
grant insert, delete                                         on public.post_tags to authenticated;
grant insert (post_id, parent_id, body)                      on public.comments to authenticated;
grant delete                                                 on public.comments to authenticated;

-- ---------------------------------------------------------------------------
-- tag listings with counts. Definer functions: the counts must mean the same
-- for everybody (public posts only, all followers), whoever is asking.
-- ---------------------------------------------------------------------------

create or replace function public.list_tags(
  p_q      text default null,
  p_kind   text default null,
  p_sort   text default 'hot',
  p_limit  int  default 30,
  p_offset int  default 0
)
returns table (
  id uuid, slug text, name text, kind text, description text, cover_url text,
  created_at timestamptz, post_count int, follower_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select
      t.id, t.slug, t.name, t.kind, t.description, t.cover_url, t.created_at,
      (select count(*)::int
         from public.post_tags pt
         join public.posts p on p.id = pt.post_id
        where pt.tag_id = t.id and p.visibility = 'public' and p.removed_at is null) as post_count,
      (select count(*)::int from public.tag_follows f where f.tag_id = t.id) as follower_count
    from public.tags t
    where (p_kind is null or t.kind = p_kind)
      and (
        p_q is null or btrim(p_q) = ''
        or t.name ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
  )
  select c.id, c.slug, c.name, c.kind, c.description, c.cover_url, c.created_at, c.post_count, c.follower_count
  from counted c
  order by
    case when p_sort = 'new' then extract(epoch from c.created_at)
         else c.post_count::numeric * 1000000 + c.follower_count end desc,
    c.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0)
$$;

create or replace function public.get_tag(p_slug text)
returns table (
  id uuid, slug text, name text, kind text, description text, cover_url text,
  external jsonb, created_by uuid, created_at timestamptz, post_count int, follower_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id, t.slug, t.name, t.kind, t.description, t.cover_url, t.external, t.created_by, t.created_at,
    (select count(*)::int
       from public.post_tags pt
       join public.posts p on p.id = pt.post_id
      where pt.tag_id = t.id and p.visibility = 'public' and p.removed_at is null),
    (select count(*)::int from public.tag_follows f where f.tag_id = t.id)
  from public.tags t
  where t.slug = p_slug
$$;

revoke all on function public.list_tags(text, text, text, int, int) from public;
revoke all on function public.get_tag(text)                          from public;
grant execute on function public.list_tags(text, text, text, int, int) to anon, authenticated;
grant execute on function public.get_tag(text)                          to anon, authenticated;

-- ---------------------------------------------------------------------------
-- post search (RLS applies: public posts plus your own private ones).
-- Plain ILIKE works anywhere; 0005_pgroonga_posts.sql swaps in a CJK-aware
-- implementation with the same signature.
-- ---------------------------------------------------------------------------

create or replace function public.search_posts(q text, lim int default 30, off int default 0)
returns setof public.posts
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.posts p
  where char_length(btrim(q)) > 0
    and (
      p.plain_text ilike '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or exists (
        select 1
        from public.post_tags pt
        join public.tags t on t.id = pt.tag_id
        where pt.post_id = p.id
          and t.name ilike '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
    )
  order by p.created_at desc
  limit least(greatest(lim, 1), 100)
  offset greatest(off, 0)
$$;

revoke all on function public.search_posts(text, int, int) from public;
grant execute on function public.search_posts(text, int, int) to anon, authenticated;
