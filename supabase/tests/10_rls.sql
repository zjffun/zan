-- Schema + row level security tests for the tags-and-posts model
-- (0004_tags_and_posts.sql). Runs as a superuser and switches roles the way
-- PostgREST does (role + request.jwt.claims). Any failed assertion aborts.
--
-- Layout: helpers, fixtures (committed once), then one section per table or
-- function. Every scenario after the fixtures runs in its own transaction and
-- is rolled back, so each one starts from the same data.
--
-- Fixture ids (the hex letters in post ids say who owns the post):
--   users     ...0a = A, ...0b = B, ...0c = C
--   tags      50..01 Cowboy Bebop (anime, A)   50..02 Dune (book, B)   50..03 jazz (topic, A)
--             50..04 Hades, 50..05 Celeste, 50..06 Tetris (games, C)
--             50..07 "100%", 50..08 "A_B", 50..09 "AXB", 50..0a "back\slash" (names that stress LIKE)
--   posts     60..a1 A public (youtube + anchor)   60..a2 A private   60..a3 A removed
--             60..b1 B public   60..b2 B private   60..c1 C public (source only, no text)
--   comments  70..01 B on a1,  70..02 C replying to it,  70..03 A on its own private a2
--   follows   Bebop: A, B   Celeste: A, B, C
--
-- Public posts per tag (private and removed posts never count):
--   Bebop 1 (a1)  Dune 1 (b1)  jazz 1 (a1)  Hades 2 (b1, c1)  Celeste 1 (c1)  Tetris 0

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''

create schema t;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ASSERT FAILED: %', msg; end if;
end $$;
-- The statement must fail. Pass a SQLSTATE to also pin down why:
--   42501 permission denied / row level security, 23505 unique, 23514 check or
--   trigger rule, 23503 foreign key, 23502 not null.
create function t.raises(stmt text, msg text, state text default null) returns void language plpgsql as $$
declare
  got text;
  err text;
begin
  begin
    execute stmt;
  exception when others then
    got := sqlstate;
    err := sqlerrm;
    if state is not null and got <> state then
      raise exception 'ASSERT FAILED (expected SQLSTATE %, got % "%"): %', state, got, err, msg;
    end if;
    return;
  end;
  raise exception 'ASSERT FAILED (expected an error): %', msg;
end $$;
-- Runs an insert/update/delete and says how many rows it touched (RLS filters silently).
create function t.rows(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;
-- list_tags as a list of tag names, in the order the function returns them.
create function t.tag_names(p_q text default null, p_kind text default null, p_sort text default 'hot',
                            p_limit int default 30, p_offset int default 0)
returns text[] language sql as $$
  select coalesce(array_agg(l.name order by l.ordinality), '{}'::text[])
  from public.list_tags(p_q, p_kind, p_sort, p_limit, p_offset) with ordinality as l
$$;
-- search_posts as a list of post-id suffixes (a1, b2 ...), in the order the function returns them.
create function t.found(q text, n int default 30, skip int default 0)
returns text[] language sql as $$
  select coalesce(array_agg(right(s.id::text, 2) order by s.ordinality), '{}'::text[])
  from public.search_posts(q, n, skip) with ordinality as s
$$;
grant usage on schema t to anon, authenticated;

-- ---------------------------------------------------------------------------
-- fixtures (written as the superuser, so they bypass RLS and column grants)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  (:A, 'a@example.com'), (:B, 'b@example.com'), (:C, 'c@example.com');

insert into public.tags (id, slug, name, kind, external, created_by, created_at) values
  ('50000000-0000-0000-0000-000000000001', 'bebop001', 'Cowboy Bebop', 'anime', '{"bangumi":"1"}',           :A, '2024-01-10'),
  ('50000000-0000-0000-0000-000000000002', 'dune0001', 'Dune',         'book',  '{"openlibrary":"OL45883W"}', :B, '2024-01-20'),
  ('50000000-0000-0000-0000-000000000003', 'jazz0001', 'jazz',         null,    '{}',                         :A, '2024-01-30'),
  ('50000000-0000-0000-0000-000000000004', 'hades001', 'Hades',        'game',  '{}',                         :C, '2024-02-01'),
  ('50000000-0000-0000-0000-000000000005', 'celeste1', 'Celeste',      'game',  '{}',                         :C, '2024-02-02'),
  ('50000000-0000-0000-0000-000000000006', 'tetris01', 'Tetris',       'game',  '{}',                         :C, '2024-02-03'),
  ('50000000-0000-0000-0000-000000000007', 'percent1', '100%',         null,    '{}',                         :C, '2024-02-04'),
  ('50000000-0000-0000-0000-000000000008', 'under001', 'A_B',          null,    '{}',                         :C, '2024-02-05'),
  ('50000000-0000-0000-0000-000000000009', 'axb00001', 'AXB',          null,    '{}',                         :C, '2024-02-06'),
  ('50000000-0000-0000-0000-00000000000a', 'slash001', 'back\slash',   null,    '{}',                         :C, '2024-02-07');

insert into public.posts (id, author, body, plain_text, source, anchor, visibility, removed_at, created_at) values
  ('60000000-0000-0000-0000-0000000000a1', :A, '{"type":"doc","content":[]}', 'public note about the opening',
     '{"provider":"youtube","ref":{"videoId":"dQw4w9WgXcQ"},"meta":{"title":"t"}}', '{"t":754}', 'public', null, '2024-05-01'),
  ('60000000-0000-0000-0000-0000000000a2', :A, '{"type":"doc","content":[]}', 'secret note on the ending',
     null, null, 'private', null, '2024-05-02'),
  ('60000000-0000-0000-0000-0000000000a3', :A, '{"type":"doc","content":[]}', 'taken down note',
     null, null, 'public', '2024-05-03', '2024-05-03'),
  ('60000000-0000-0000-0000-0000000000b1', :B, '{"type":"doc","content":[]}', 'dune review: 100% worth it',
     null, null, 'public', null, '2024-05-04'),
  ('60000000-0000-0000-0000-0000000000b2', :B, '{"type":"doc","content":[]}', 'private dune thoughts',
     null, null, 'private', null, '2024-05-05'),
  ('60000000-0000-0000-0000-0000000000c1', :C, '{"type":"doc","content":[]}', '',
     '{"provider":"link","ref":{"url":"https://example.com"}}', null, 'public', null, '2024-05-06');

insert into public.post_tags (post_id, tag_id) values
  ('60000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000003'),
  ('60000000-0000-0000-0000-0000000000a2', '50000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-0000000000a2', '50000000-0000-0000-0000-000000000006'),
  ('60000000-0000-0000-0000-0000000000a3', '50000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-0000000000a3', '50000000-0000-0000-0000-000000000006'),
  ('60000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000002'),
  ('60000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000004'),
  ('60000000-0000-0000-0000-0000000000b2', '50000000-0000-0000-0000-000000000002'),
  ('60000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-000000000004'),
  ('60000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-000000000005');

insert into public.tag_follows (tag_id, user_id) values
  ('50000000-0000-0000-0000-000000000001', :A), ('50000000-0000-0000-0000-000000000001', :B),
  ('50000000-0000-0000-0000-000000000005', :A), ('50000000-0000-0000-0000-000000000005', :B),
  ('50000000-0000-0000-0000-000000000005', :C);

insert into public.comments (id, post_id, parent_id, author, body) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-0000000000a1', null, :B, 'great find');
insert into public.comments (id, post_id, parent_id, author, body) values
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-000000000001', :C, 'agreed');
insert into public.comments (id, post_id, parent_id, author, body) values
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-0000000000a2', null, :A, 'note to self');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- the signup trigger made them
select t.ok((select count(*) from public.profiles where id in (:A, :B, :C)) = 3, 'every new auth user gets a profile');
select t.ok((select nickname from public.profiles where id = :A) = public.default_nickname(:A::uuid),
  'the generated nickname is default_nickname(id)');
select t.ok((select nickname from public.profiles where id = :A) like '攒友%'
        and (select char_length(nickname) from public.profiles where id = :A) = 8,
  'the generated nickname is the prefix plus a 6 character suffix');
select t.ok((select bio from public.profiles where id = :A) = '', 'bio starts empty');

-- a nickname collision at signup falls back to a longer suffix instead of failing the signup
begin;
update public.profiles set nickname = public.default_nickname('00000000-0000-0000-0000-0000000000d1') where id = :A;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'd1@example.com');
select t.ok((select nickname from public.profiles where id = '00000000-0000-0000-0000-0000000000d1')
            = public.default_nickname('00000000-0000-0000-0000-0000000000d1', 12),
  'a colliding generated nickname gets the longer suffix');
rollback;

-- the signup trigger works for a role that cannot write profiles itself (on Supabase that is the auth service)
begin;
grant insert on auth.users to authenticated;  -- stands in for the auth service role; undone by the rollback
set local role authenticated;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d2', 'd2@example.com');
reset role;
select t.ok((select nickname from public.profiles where id = '00000000-0000-0000-0000-0000000000d2')
            = public.default_nickname('00000000-0000-0000-0000-0000000000d2'),
  'the signup trigger runs with its owner''s rights, not the inserting role''s');
rollback;

-- anonymous visitors can read profiles but not write them
begin;
set local role anon;
select t.ok((select count(*) from public.profiles) = 3, 'anon can read profiles');
select t.raises($$ update public.profiles set bio = 'x' $$, 'anon cannot update profiles', '42501');
select t.raises($$ insert into public.profiles (id, nickname) values (gen_random_uuid(), 'nobody') $$,
  'anon cannot insert profiles', '42501');
select t.raises($$ delete from public.profiles $$, 'anon cannot delete profiles', '42501');
rollback;

-- signed-in users: read everything, edit only their own nickname and bio
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;

select t.ok((select count(*) from public.profiles) = 3, 'signed-in users can read every profile');
select t.ok(t.rows($$ update public.profiles set nickname = 'Alice', bio = 'I collect openings'
                      where id = '00000000-0000-0000-0000-00000000000a' $$) = 1,
  'a user can edit their own nickname and bio');
select t.ok((select nickname from public.profiles where id = :A) = 'Alice', 'the new nickname is stored');
select t.ok(t.rows($$ update public.profiles set nickname = 'ALICE' where id = '00000000-0000-0000-0000-00000000000a' $$) = 1,
  'changing only the case of your own nickname is not a collision with yourself');

select t.ok(t.rows($$ update public.profiles set bio = 'hacked' where id = '00000000-0000-0000-0000-00000000000b' $$) = 0,
  'a user cannot edit someone else''s profile');
select t.ok(t.rows($$ update public.profiles set nickname = 'hacked' where id = '00000000-0000-0000-0000-00000000000b' $$) = 0,
  'nor their nickname');
select t.ok((select bio from public.profiles where id = :B) = '', 'the other profile is unchanged');

select t.raises($$ update public.profiles set id = gen_random_uuid() where id = '00000000-0000-0000-0000-00000000000a' $$,
  'the profile id is not editable', '42501');
select t.raises($$ update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-00000000000a' $$,
  'created_at is not editable', '42501');
select t.raises($$ insert into public.profiles (id, nickname) values (gen_random_uuid(), 'nobody') $$,
  'profiles are only created by the signup trigger', '42501');
select t.raises($$ delete from public.profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
  'profiles cannot be deleted by their owner (delete the account instead)', '42501');
rollback;

-- nickname rules
begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
update public.profiles set nickname = 'Bobby' where id = :B;

select t.ok(t.rows($$ update public.profiles set nickname = repeat('x', 24) where id = '00000000-0000-0000-0000-00000000000b' $$) = 1,
  '24 characters is fine');
select t.ok(t.rows($$ update public.profiles set nickname = repeat('攒', 24) where id = '00000000-0000-0000-0000-00000000000b' $$) = 1,
  'the limit counts characters, not bytes');
select t.ok(t.rows($$ update public.profiles set nickname = 'x' where id = '00000000-0000-0000-0000-00000000000b' $$) = 1,
  'a single character is fine');
update public.profiles set nickname = 'Bobby' where id = :B;

select t.raises($$ update public.profiles set nickname = '' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'empty nickname', '23514');
select t.raises($$ update public.profiles set nickname = repeat('x', 25) where id = '00000000-0000-0000-0000-00000000000b' $$,
  'nickname over 24 characters', '23514');
select t.raises($$ update public.profiles set nickname = ' padded' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'leading space', '23514');
select t.raises($$ update public.profiles set nickname = 'padded ' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'trailing space', '23514');
select t.raises($$ update public.profiles set nickname = 'tab' || chr(9) || 'bed' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'tab inside the nickname', '23514');
select t.raises($$ update public.profiles set nickname = 'two' || chr(10) || 'lines' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'newline inside the nickname', '23514');
select t.raises($$ update public.profiles set nickname = 'bell' || chr(7) where id = '00000000-0000-0000-0000-00000000000b' $$,
  'control character at the end of the nickname', '23514');
select t.raises($$ update public.profiles set nickname = null where id = '00000000-0000-0000-0000-00000000000b' $$,
  'nickname is required', '23502');
select t.ok((select nickname from public.profiles where id = :B) = 'Bobby', 'rejected nicknames leave the old one in place');

select t.ok(t.rows($$ update public.profiles set bio = repeat('b', 200) where id = '00000000-0000-0000-0000-00000000000b' $$) = 1,
  'a 200 character bio is fine');
select t.raises($$ update public.profiles set bio = repeat('b', 201) where id = '00000000-0000-0000-0000-00000000000b' $$,
  'bio over 200 characters', '23514');

-- uniqueness ignores case
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.raises($$ update public.profiles set nickname = 'bobby' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'nicknames are unique case-insensitively (lower case)', '23505');
select t.raises($$ update public.profiles set nickname = 'BOBBY' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'nicknames are unique case-insensitively (upper case)', '23505');
select t.raises($$ update public.profiles set nickname = 'Bobby' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'nicknames are unique (exact match)', '23505');
rollback;

-- ---------------------------------------------------------------------------
-- tags: reading and creating
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select t.ok((select count(*) from public.tags) = 10, 'anon can read tags');
select t.ok((select name from public.tags where slug = 'bebop001') = 'Cowboy Bebop', 'and find one by slug');
select t.raises($$ insert into public.tags (name) values ('anon tag') $$, 'anon cannot add a tag', '42501');
select t.raises($$ update public.tags set description = 'x' $$, 'anon cannot edit a tag', '42501');
select t.raises($$ delete from public.tags $$, 'anon cannot delete a tag', '42501');
rollback;

begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.tags) = 10, 'signed-in users can read tags');

insert into public.tags (name, kind, description, cover_url, external)
  values ('Spice and Wolf', 'anime', 'a merchant and a wolf', 'https://example.com/cover.jpg', '{"bangumi":"2","isbn":"9784048"}');
select t.ok((select created_by from public.tags where name = 'Spice and Wolf') = :A, 'created_by defaults to the caller');
select t.ok((select slug from public.tags where name = 'Spice and Wolf') ~ '^[a-z0-9]{10}$', 'a slug is generated');
select t.ok((select external ->> 'isbn' from public.tags where name = 'Spice and Wolf') = '9784048', 'the catalog ids are stored');

insert into public.tags (name) values ('A plain topic'), ('Another topic');
select t.ok((select kind from public.tags where name = 'A plain topic') is null, 'kind is optional (plain topics)');
select t.ok((select external from public.tags where name = 'A plain topic') = '{}', 'external defaults to an empty object');
select t.ok((select count(distinct slug) from public.tags where name in ('A plain topic', 'Another topic')) = 2,
  'generated slugs differ');
select t.ok(t.rows($$ insert into public.tags (name) values (repeat('x', 30)) $$) = 1, 'a 30 character name is fine');
select t.ok(t.rows($$ insert into public.tags (name) values ('Fate/Zero: 第二季') $$) = 1,
  'spaces, slashes, colons and CJK are fine in a name');

-- names
select t.raises($$ insert into public.tags (name) values ('cowboy bebop') $$,
  'names are unique case-insensitively (lower case)', '23505');
select t.raises($$ insert into public.tags (name) values ('COWBOY BEBOP') $$,
  'names are unique case-insensitively (upper case)', '23505');
select t.raises($$ insert into public.tags (name) values ('Cowboy Bebop') $$, 'names are unique (exact match)', '23505');
select t.raises($$ insert into public.tags (name) values ('') $$, 'empty name', '23514');
select t.raises($$ insert into public.tags (name) values (repeat('x', 31)) $$, 'name over 30 characters', '23514');
select t.raises($$ insert into public.tags (name) values ('#hashtag') $$, 'name starting with #', '23514');
select t.raises($$ insert into public.tags (name) values ('mid#dle') $$, 'name containing #', '23514');
select t.raises($$ insert into public.tags (name) values (' padded') $$, 'name with a leading space', '23514');
select t.raises($$ insert into public.tags (name) values ('padded ') $$, 'name with a trailing space', '23514');
select t.raises($$ insert into public.tags (name) values ('tab' || chr(9) || 'bed') $$, 'name with a tab', '23514');
select t.raises($$ insert into public.tags (name) values ('two' || chr(10) || 'lines') $$, 'name with a newline', '23514');
select t.raises($$ insert into public.tags (name) values (null) $$, 'name is required', '23502');

-- other columns
select t.raises($$ insert into public.tags (name, kind) values ('music thing', 'music') $$, 'unknown kind', '23514');
select t.raises($$ insert into public.tags (name, description) values ('long one', repeat('d', 301)) $$,
  'description over 300 characters', '23514');
select t.raises($$ insert into public.tags (name, cover_url) values ('plain http', 'http://example.com/c.jpg') $$,
  'cover_url must be https', '23514');
select t.raises($$ insert into public.tags (name, cover_url) values ('js url', 'javascript:alert(1)') $$,
  'cover_url must not be a script url', '23514');
select t.raises($$ insert into public.tags (name, cover_url) values ('huge url', 'https://example.com/' || repeat('x', 1000)) $$,
  'cover_url over 1000 characters', '23514');
select t.raises($$ insert into public.tags (name, external) values ('array ext', '[]') $$, 'external must be an object', '23514');
select t.raises($$ insert into public.tags (name, external) values ('string ext', '"x"') $$, 'external must be an object (string)', '23514');

-- a catalog entry becomes one tag
select t.raises($$ insert into public.tags (name, external) values ('Bebop again', '{"bangumi":"1"}') $$,
  'the same bangumi id cannot be added twice', '23505');
select t.raises($$ insert into public.tags (name, external) values ('Dune again', '{"openlibrary":"OL45883W"}') $$,
  'the same openlibrary id cannot be added twice', '23505');
select t.ok(t.rows($$ insert into public.tags (name, external) values ('Other show', '{"bangumi":"99","openlibrary":"OL1W"}') $$) = 1,
  'a different catalog id is fine');
select t.ok(t.rows($$ insert into public.tags (name, external) values ('Bangumi 1 as a book', '{"openlibrary":"1"}') $$) = 1,
  'the bangumi and openlibrary id spaces are separate');

-- nothing but the user-facing columns can be written on insert
select t.raises($$ insert into public.tags (name, created_by) values ('forged', '00000000-0000-0000-0000-00000000000b') $$,
  'cannot create a tag on behalf of someone else', '42501');
select t.raises($$ insert into public.tags (name, created_by) values ('forged self', '00000000-0000-0000-0000-00000000000a') $$,
  'created_by is not a client column even for yourself', '42501');
select t.raises($$ insert into public.tags (name, slug) values ('forged slug', 'mychosen1') $$, 'slug is not client-writable', '42501');
select t.raises($$ insert into public.tags (id, name) values (gen_random_uuid(), 'forged id') $$, 'id is not client-writable', '42501');
select t.raises($$ insert into public.tags (name, created_at) values ('forged time', '2000-01-01') $$,
  'created_at is not client-writable', '42501');
rollback;

-- ---------------------------------------------------------------------------
-- tags: editing (creator only, description and cover only)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;

select t.ok(t.rows($$ update public.tags set description = 'the best', cover_url = 'https://example.com/x.jpg'
                      where id = '50000000-0000-0000-0000-000000000001' $$) = 1,
  'the creator can edit description and cover_url');
select t.ok((select description from public.tags where slug = 'bebop001') = 'the best', 'the new description is stored');
select t.ok(t.rows($$ update public.tags set cover_url = null where id = '50000000-0000-0000-0000-000000000001' $$) = 1,
  'the creator can clear the cover');
select t.ok(t.rows($$ update public.tags set description = 'mine now' where id = '50000000-0000-0000-0000-000000000002' $$) = 0,
  'someone else''s tag cannot be edited');
select t.ok((select description from public.tags where slug = 'dune0001') = '', 'and it is unchanged');
select t.ok(t.rows($$ update public.tags set description = 'mass edit' where created_by is distinct from '00000000-0000-0000-0000-00000000000a' $$) = 0,
  'an update without a filter only reaches the caller''s own tags');

select t.raises($$ update public.tags set name = 'Renamed' where id = '50000000-0000-0000-0000-000000000001' $$,
  'nobody can rename a tag, not even its creator', '42501');
select t.raises($$ update public.tags set kind = 'game' where id = '50000000-0000-0000-0000-000000000001' $$, 'kind is fixed', '42501');
select t.raises($$ update public.tags set external = '{}' where id = '50000000-0000-0000-0000-000000000001' $$,
  'external is fixed', '42501');
select t.raises($$ update public.tags set slug = 'newslug1' where id = '50000000-0000-0000-0000-000000000001' $$, 'slug is fixed', '42501');
select t.raises($$ update public.tags set created_by = '00000000-0000-0000-0000-00000000000b' where id = '50000000-0000-0000-0000-000000000001' $$,
  'a tag cannot be handed to someone else', '42501');
select t.raises($$ update public.tags set description = repeat('d', 301) where id = '50000000-0000-0000-0000-000000000001' $$,
  'description over 300 characters', '23514');
select t.raises($$ update public.tags set cover_url = 'http://example.com/x.jpg' where id = '50000000-0000-0000-0000-000000000001' $$,
  'cover_url must be https', '23514');
select t.raises($$ delete from public.tags where id = '50000000-0000-0000-0000-000000000001' $$,
  'tags cannot be deleted by clients', '42501');
select t.ok((select name from public.tags where slug = 'bebop001') = 'Cowboy Bebop', 'the name is unchanged');
rollback;

-- ---------------------------------------------------------------------------
-- posts: who sees what
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.posts where author = :A) = 2, 'an author sees their public and private posts');
select t.ok((select visibility from public.posts where id = '60000000-0000-0000-0000-0000000000a2') = 'private',
  'including the private one');
select t.ok((select count(*) from public.posts where id = '60000000-0000-0000-0000-0000000000a3') = 0,
  'a removed post is hidden from its author');
select t.ok((select count(*) from public.posts) = 4, 'the author also sees other people''s public posts, not their private ones');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.posts where author = :A) = 1, 'other users see only the public post of A');
select t.ok((select count(*) from public.posts where id = '60000000-0000-0000-0000-0000000000a2') = 0, 'not the private one');
select t.ok((select count(*) from public.posts where id = '60000000-0000-0000-0000-0000000000b2') = 1, 'but their own private post');
select t.ok((select count(*) from public.posts) = 4, 'B sees 3 public posts plus their own private one');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :C::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.posts where visibility = 'private') = 0, 'C has no private posts and sees none');
rollback;

begin;
set local role anon;
select t.ok((select count(*) from public.posts) = 3, 'anon sees exactly the public, non-removed posts');
select t.ok((select count(*) from public.posts where author = :A) = 1, 'and only one of A''s');
select t.ok((select count(*) from public.posts where visibility = 'private') = 0, 'anon sees no private post');
select t.ok((select plain_text from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'public note about the opening',
  'anon can read a public post');
select t.raises($$ insert into public.posts (body, plain_text) values ('{}', 'anon post') $$, 'anon cannot post', '42501');
select t.raises($$ update public.posts set plain_text = 'x' $$, 'anon cannot edit posts', '42501');
select t.raises($$ delete from public.posts $$, 'anon cannot delete posts', '42501');
rollback;

-- an operator takes a post down: nobody sees it any more, not even its author
begin;
update public.posts set removed_at = now() where id = '60000000-0000-0000-0000-0000000000a1';
insert into public.comments (id, post_id, author, body)
  values ('70000000-0000-0000-0000-0000000000f1', '60000000-0000-0000-0000-0000000000a3', :B, 'from before the takedown');

select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 0,
  'a removed post is invisible to its author');
select t.ok((select count(*) from public.posts where author = :A) = 1, 'only the private post is left');
select t.ok(t.rows($$ update public.posts set plain_text = 'back from the dead' where id = '60000000-0000-0000-0000-0000000000a1' $$) = 0,
  'the author cannot edit a removed post');
select t.ok((select count(*) from public.post_tags where post_id in ('60000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a3')) = 0,
  'the tags of removed posts are invisible too');
select t.ok((select count(*) from public.comments where post_id in ('60000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a3')) = 0,
  'and so are their comments');
select t.raises($$ insert into public.post_tags (post_id, tag_id) values ('60000000-0000-0000-0000-0000000000a3', '50000000-0000-0000-0000-000000000002') $$,
  'tags cannot be attached to a removed post', '42501');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.posts where id in ('60000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a3')) = 0,
  'a removed post is invisible to other users');
select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a1', 'still there?') $$,
  'nobody can comment on a removed post', '42501');
select t.raises($$ insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a1') $$,
  'nobody can like a removed post', '42501');
select t.raises($$ insert into public.favorites (post_id) values ('60000000-0000-0000-0000-0000000000a3') $$,
  'nobody can favorite a removed post', '42501');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select t.ok((select count(*) from public.posts where id in ('60000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a3')) = 0,
  'a removed post is invisible to anon');
select t.ok((select count(*) from public.posts) = 2, 'anon sees what is left (b1, c1)');
rollback;

-- ---------------------------------------------------------------------------
-- posts: creating (constraints and column grants)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;

insert into public.posts (body, plain_text) values ('{"type":"doc","content":[]}', 'a fresh note');
select t.ok((select author from public.posts where plain_text = 'a fresh note') = :A, 'author defaults to the caller');
select t.ok((select visibility from public.posts where plain_text = 'a fresh note') = 'public', 'posts are public by default');
select t.ok((select like_count + comment_count from public.posts where plain_text = 'a fresh note') = 0, 'counters start at zero');
select t.ok((select source_status from public.posts where plain_text = 'a fresh note') = 'ok'
        and (select source_fail_count from public.posts where plain_text = 'a fresh note') = 0
        and (select source_checked_at from public.posts where plain_text = 'a fresh note') is null
        and (select removed_at from public.posts where plain_text = 'a fresh note') is null,
  'source health starts clean and the post is not removed');
select t.ok((select created_at from public.posts where plain_text = 'a fresh note') is not null
        and (select updated_at from public.posts where plain_text = 'a fresh note') is not null, 'timestamps are set');

-- a post needs text, a source or an anchor
select t.ok(t.rows($$ insert into public.posts (body, source) values ('{}', '{"provider":"link","ref":{"url":"https://example.com"}}') $$) = 1,
  'a post can be just a source');
select t.ok(t.rows($$ insert into public.posts (body, anchor) values ('{}', '{"t":12}') $$) = 1, 'a post can be just an anchor');
select t.ok(t.rows($$ insert into public.posts (body, plain_text, visibility) values ('{}', 'only me', 'private') $$) = 1,
  'a post can be private');
select t.raises($$ insert into public.posts (body, plain_text) values ('{}', '') $$,
  'an empty post is rejected', '23514');
select t.raises($$ insert into public.posts (body) values ('{}') $$, 'a post without text, source or anchor is rejected', '23514');
select t.raises($$ insert into public.posts (body, plain_text, source, anchor) values ('{}', '', null, null) $$,
  'explicit nulls are rejected too', '23514');

-- anchors
select t.ok(t.rows($$ insert into public.posts (body, anchor) values ('{}', jsonb_build_object('page', 132, 'quote', repeat('q', 200))) $$) = 1,
  'a 200 character quote is fine');
select t.raises($$ insert into public.posts (body, anchor) values ('{}', jsonb_build_object('page', 132, 'quote', repeat('q', 201))) $$,
  'a quote over 200 characters is rejected', '23514');
select t.ok(t.rows($$ insert into public.posts (body, anchor) values ('{}', jsonb_build_object('page', 132, 'quote', repeat('攒', 200))) $$) = 1,
  'the quote limit counts characters, not bytes');
select t.raises($$ insert into public.posts (body, plain_text, anchor) values ('{}', 'x', '[]') $$, 'anchor must be an object (array)', '23514');
select t.raises($$ insert into public.posts (body, plain_text, anchor) values ('{}', 'x', '5') $$, 'anchor must be an object (number)', '23514');

-- positions: a list, each with an optional note (migration 0007)
select t.ok((select anchors from public.posts where plain_text = 'a fresh note') = '[]'::jsonb, 'a post starts with no positions');
select t.ok(t.rows($$ insert into public.posts (body, anchors) values ('{}', '[{"t":12,"note":"开场"},{"t":900,"t_end":960},{"page":132,"note":"x"}]') $$) = 1,
  'a post can be just a list of positions');
select t.ok(t.rows($$ insert into public.posts (body, anchors) values ('{}', jsonb_build_array(jsonb_build_object('page', 1, 'note', repeat('攒', 200)))) $$) = 1,
  'a 200 character note is fine, counted in characters');
select t.raises($$ insert into public.posts (body, anchors) values ('{}', jsonb_build_array(jsonb_build_object('page', 1, 'note', repeat('q', 201)))) $$,
  'a note over 200 characters is rejected', '23514');
select t.raises($$ insert into public.posts (body, anchors) values ('{}', jsonb_build_array(jsonb_build_object('t', 1, 'note', 'ok'), jsonb_build_object('t', 2, 'note', repeat('q', 201)))) $$,
  'every note is checked, not only the first', '23514');
select t.raises($$ insert into public.posts (body, plain_text, anchors) values ('{}', 'x', '{"t":1}') $$, 'anchors must be an array (object)', '23514');
select t.raises($$ insert into public.posts (body, plain_text, anchors) values ('{}', 'x', '5') $$, 'anchors must be an array (number)', '23514');
select t.raises($$ insert into public.posts (body, plain_text, anchors) values ('{}', 'x', '[5]') $$, 'every position must be an object (number)', '23514');
select t.raises($$ insert into public.posts (body, plain_text, anchors) values ('{}', 'x', '[[1]]') $$, 'every position must be an object (array)', '23514');
select t.raises($$ insert into public.posts (body, plain_text, anchors) values ('{}', 'x', null) $$, 'anchors cannot be null', '23502');
select t.ok(t.rows($$ insert into public.posts (body, anchors) select '{}', jsonb_agg(jsonb_build_object('t', n)) from generate_series(1, 20) n $$) = 1,
  'twenty positions are fine');
select t.raises($$ insert into public.posts (body, anchors) select '{}', jsonb_agg(jsonb_build_object('t', n)) from generate_series(1, 21) n $$,
  'twenty-one positions are too many', '23514');
select t.raises($$ insert into public.posts (body, plain_text, anchors) values ('{}', '', '[]') $$,
  'no text, no source and no positions is still an empty post', '23514');

-- source, body, text, visibility
select t.raises($$ insert into public.posts (body, plain_text, source) values ('{}', 'x', '[]') $$, 'source must be an object', '23514');
select t.raises($$ insert into public.posts (body, plain_text, source) values ('{}', 'x', '"https://example.com"') $$,
  'source must be an object (string)', '23514');
select t.raises($$ insert into public.posts (body, plain_text) values ('[]', 'x') $$, 'body must be an object', '23514');
select t.raises($$ insert into public.posts (body, plain_text) values (null, 'x') $$, 'body is required', '23502');
select t.ok(t.rows($$ insert into public.posts (body, plain_text) values (jsonb_build_object('type', 'doc', 'x', repeat('x', 100000)), 'big') $$) = 1,
  'a 100 kB body is fine');
select t.raises($$ insert into public.posts (body, plain_text) values (jsonb_build_object('type', 'doc', 'x', repeat('x', 200000)), 'huge') $$,
  'a body of 200 kB or more is rejected', '23514');
select t.ok(t.rows($$ insert into public.posts (body, plain_text) values ('{}', repeat('x', 20000)) $$) = 1, '20000 characters of text are fine');
select t.raises($$ insert into public.posts (body, plain_text) values ('{}', repeat('x', 20001)) $$,
  'text over 20000 characters is rejected', '23514');
select t.raises($$ insert into public.posts (body, plain_text, visibility) values ('{}', 'x', 'unlisted') $$,
  'unknown visibility', '23514');

-- clients cannot write anything but the content columns
select t.raises($$ insert into public.posts (body, plain_text, author) values ('{}', 'x', '00000000-0000-0000-0000-00000000000b') $$,
  'cannot post as another author', '42501');
select t.raises($$ insert into public.posts (body, plain_text, author) values ('{}', 'x', '00000000-0000-0000-0000-00000000000a') $$,
  'author is not a client column even for yourself', '42501');
select t.raises($$ insert into public.posts (body, plain_text, like_count) values ('{}', 'x', 5) $$, 'cannot set like_count', '42501');
select t.raises($$ insert into public.posts (body, plain_text, comment_count) values ('{}', 'x', 5) $$, 'cannot set comment_count', '42501');
select t.raises($$ insert into public.posts (body, plain_text, removed_at) values ('{}', 'x', now()) $$, 'cannot set removed_at', '42501');
select t.raises($$ insert into public.posts (body, plain_text, source_status) values ('{}', 'x', 'dead') $$, 'cannot set source_status', '42501');
select t.raises($$ insert into public.posts (body, plain_text, source_fail_count) values ('{}', 'x', 2) $$, 'cannot set source_fail_count', '42501');
select t.raises($$ insert into public.posts (body, plain_text, source_checked_at) values ('{}', 'x', now()) $$, 'cannot set source_checked_at', '42501');
select t.raises($$ insert into public.posts (body, plain_text, created_at) values ('{}', 'x', '2000-01-01') $$, 'cannot set created_at', '42501');
select t.raises($$ insert into public.posts (body, plain_text, updated_at) values ('{}', 'x', '2000-01-01') $$, 'cannot set updated_at', '42501');
select t.raises($$ insert into public.posts (id, body, plain_text) values (gen_random_uuid(), '{}', 'x') $$, 'cannot choose the id', '42501');
rollback;

-- ---------------------------------------------------------------------------
-- posts: editing and deleting
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;

select t.ok(t.rows($$ update public.posts set plain_text = 'hijacked' where id = '60000000-0000-0000-0000-0000000000a1' $$) = 0,
  'another user cannot edit a public post');
select t.ok(t.rows($$ update public.posts set plain_text = 'hijacked' where id = '60000000-0000-0000-0000-0000000000a2' $$) = 0,
  'nor a private one');
select t.ok(t.rows($$ update public.posts set visibility = 'private' where author = '00000000-0000-0000-0000-00000000000a' $$) = 0,
  'nor flip its visibility');
select t.ok(t.rows($$ delete from public.posts where id = '60000000-0000-0000-0000-0000000000a1' $$) = 0,
  'another user cannot delete a public post');
select t.ok(t.rows($$ delete from public.posts where id = '60000000-0000-0000-0000-0000000000a2' $$) = 0, 'nor a private one');
reset role;
select t.ok((select plain_text from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'public note about the opening',
  'A''s public post is untouched');
select t.ok((select count(*) from public.posts where author = :A) = 3, 'and all of A''s posts are still there');

select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ update public.posts set plain_text = 'edited', body = '{"type":"doc","content":[{"type":"paragraph"}]}',
                                                visibility = 'private', anchor = '{"t":99}'
                      where id = '60000000-0000-0000-0000-0000000000a1' $$) = 1,
  'the author can edit content and visibility');
select t.ok((select plain_text from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'edited'
        and (select visibility from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'private'
        and (select anchor ->> 't' from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = '99',
  'the edit is stored');
select t.raises($$ update public.posts set plain_text = '', source = null, anchor = null where id = '60000000-0000-0000-0000-0000000000a1' $$,
  'editing cannot leave a post empty', '23514');
insert into public.posts (body, source) values ('{}', '{"provider":"link","ref":{"url":"https://example.org"}}');
select t.raises($$ update public.posts set source = null where author = '00000000-0000-0000-0000-00000000000a' and plain_text = '' $$,
  'a source-only post cannot drop its source', '23514');
select t.raises($$ update public.posts set anchor = jsonb_build_object('quote', repeat('q', 201)) where id = '60000000-0000-0000-0000-0000000000a1' $$,
  'an edit cannot make the quote longer than 200 characters', '23514');
select t.raises($$ update public.posts set visibility = 'secret' where id = '60000000-0000-0000-0000-0000000000a1' $$,
  'unknown visibility', '23514');

-- the columns the client cannot touch
select t.raises($$ update public.posts set like_count = 99 where id = '60000000-0000-0000-0000-0000000000a1' $$, 'cannot set like_count', '42501');
select t.raises($$ update public.posts set comment_count = 99 where id = '60000000-0000-0000-0000-0000000000a1' $$, 'cannot set comment_count', '42501');
select t.raises($$ update public.posts set removed_at = now() where id = '60000000-0000-0000-0000-0000000000a1' $$, 'cannot set removed_at', '42501');
select t.raises($$ update public.posts set removed_at = null where id = '60000000-0000-0000-0000-0000000000a3' $$, 'cannot clear removed_at', '42501');
select t.raises($$ update public.posts set source_status = 'dead' where id = '60000000-0000-0000-0000-0000000000a1' $$, 'cannot set source_status', '42501');
select t.raises($$ update public.posts set source_fail_count = 2 where id = '60000000-0000-0000-0000-0000000000a1' $$, 'cannot set source_fail_count', '42501');
select t.raises($$ update public.posts set source_checked_at = now() where id = '60000000-0000-0000-0000-0000000000a1' $$, 'cannot set source_checked_at', '42501');
select t.raises($$ update public.posts set author = '00000000-0000-0000-0000-00000000000b' where id = '60000000-0000-0000-0000-0000000000a1' $$,
  'cannot hand a post to someone else', '42501');
select t.raises($$ update public.posts set created_at = '2000-01-01' where id = '60000000-0000-0000-0000-0000000000a1' $$, 'cannot set created_at', '42501');
select t.raises($$ update public.posts set updated_at = '2000-01-01' where id = '60000000-0000-0000-0000-0000000000a1' $$, 'cannot set updated_at', '42501');
select t.raises($$ update public.posts set id = gen_random_uuid() where id = '60000000-0000-0000-0000-0000000000a1' $$, 'cannot change the id', '42501');

select t.ok(t.rows($$ delete from public.posts where id = '60000000-0000-0000-0000-0000000000a2' $$) = 1, 'the author can delete their post');
select t.ok((select count(*) from public.posts where id = '60000000-0000-0000-0000-0000000000a2') = 0
        and (select count(*) from public.posts where author = :A) = 2, 'it is gone (a1 and the source-only post remain)');
rollback;

-- pointing a post at another source starts its health record over
begin;
-- what the link checker would have written (the superuser stands in for the service role)
update public.posts set source_status = 'dead', source_fail_count = 2, source_checked_at = '2024-06-01'
  where id = '60000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;

select t.ok((select source_status from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'dead'
        and (select source_fail_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 2,
  'precondition: the source is marked dead');
update public.posts set plain_text = 'only the text changes' where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select source_status from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'dead'
        and (select source_fail_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 2
        and (select source_checked_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') is not null,
  'editing the text keeps the health record');
update public.posts set source = source where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select source_status from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'dead'
        and (select source_fail_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 2,
  'writing the same source back keeps the health record');
update public.posts set source = '{"provider":"bilibili","ref":{"bvid":"BV1xx411c7mD"},"meta":{"title":"another"}}'
  where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select source_status from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'ok'
        and (select source_fail_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 0
        and (select source_checked_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') is null,
  'a new source resets status, fail count and checked_at');

reset role;
update public.posts set source_status = 'dead', source_fail_count = 2, source_checked_at = '2024-06-01'
  where id = '60000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
update public.posts set source = null where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select source_status from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'ok'
        and (select source_fail_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 0
        and (select source_checked_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') is null,
  'removing the source resets the health record too');
rollback;

-- updated_at moves when the content changes, not when somebody likes or comments
begin;
-- the touch trigger would overwrite a back-dated value, so switch it off while back-dating
alter table public.posts disable trigger posts_touch;
update public.posts set updated_at = '2020-01-01' where id = '60000000-0000-0000-0000-0000000000a1';
alter table public.posts enable trigger posts_touch;
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') < '2021-01-01', 'precondition: back-dated');

select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a1');
insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a1', 'a new comment');
insert into public.favorites (post_id) values ('60000000-0000-0000-0000-0000000000a1');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 1, 'the like was counted');
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') < '2021-01-01',
  'liking and commenting do not touch updated_at');
delete from public.likes where post_id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') < '2021-01-01',
  'unliking does not touch updated_at');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
update public.posts set body = '{"type":"doc","content":[{"type":"paragraph"}]}', plain_text = 'edited by the author'
  where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') > '2021-01-01',
  'editing the body bumps updated_at');

reset role;
alter table public.posts disable trigger posts_touch;
update public.posts set updated_at = '2020-01-01' where id = '60000000-0000-0000-0000-0000000000a1';
alter table public.posts enable trigger posts_touch;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
update public.posts set visibility = 'private' where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') > '2021-01-01',
  'changing the visibility bumps updated_at');
rollback;

-- the daily source check, a takedown and a save without changes are not edits (migration 0008)
begin;
alter table public.posts disable trigger posts_touch;
update public.posts set updated_at = '2020-01-01' where id = '60000000-0000-0000-0000-0000000000a1';
alter table public.posts enable trigger posts_touch;

update public.posts set source_status = 'dead', source_fail_count = 2, source_checked_at = now()
  where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select source_status from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 'dead', 'the check wrote its result');
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') < '2021-01-01',
  'the source check does not touch updated_at');

update public.posts set source_checked_at = now() where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') < '2021-01-01',
  'a check with no verdict (only the clock moves) does not touch updated_at');

update public.posts set removed_at = now() where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') < '2021-01-01',
  'a takedown does not touch updated_at');

update public.posts set body = body, plain_text = plain_text, source = source, anchors = anchors, visibility = visibility
  where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') < '2021-01-01',
  'saving without changing anything does not touch updated_at');

update public.posts set anchors = '[{"t":5}]' where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') > '2021-01-01',
  'changing the positions bumps updated_at');

alter table public.posts disable trigger posts_touch;
update public.posts set updated_at = '2020-01-01' where id = '60000000-0000-0000-0000-0000000000a1';
alter table public.posts enable trigger posts_touch;
update public.posts set source = '{"provider":"link","ref":{"url":"https://example.com/other"}}' where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select updated_at from public.posts where id = '60000000-0000-0000-0000-0000000000a1') > '2021-01-01',
  'pointing the post at something else bumps updated_at');
rollback;

-- ---------------------------------------------------------------------------
-- post_tags
-- ---------------------------------------------------------------------------

-- at most 5 tags per post
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
insert into public.posts (body, plain_text) values ('{}', 'tag cap');

select t.raises($$ insert into public.post_tags (post_id, tag_id)
                   select p.id, g.id from public.posts p, public.tags g
                   where p.plain_text = 'tag cap' and g.id in (
                     '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003',
                     '50000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000006') $$,
  'a single statement cannot attach more than 5 tags', '23514');
select t.ok((select count(*) from public.post_tags pt join public.posts p on p.id = pt.post_id where p.plain_text = 'tag cap') = 0,
  'a failed bulk insert attaches nothing');

insert into public.post_tags (post_id, tag_id)
  select p.id, g.id from public.posts p, public.tags g
  where p.plain_text = 'tag cap' and g.id in (
    '50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000005');
select t.ok((select count(*) from public.post_tags pt join public.posts p on p.id = pt.post_id where p.plain_text = 'tag cap') = 5,
  'a post can carry 5 tags');
select t.raises($$ insert into public.post_tags (post_id, tag_id)
                   select p.id, '50000000-0000-0000-0000-000000000006' from public.posts p where p.plain_text = 'tag cap' $$,
  'the 6th tag is rejected', '23514');
select t.ok(t.rows($$ delete from public.post_tags where tag_id = '50000000-0000-0000-0000-000000000005'
                      and post_id = (select id from public.posts where plain_text = 'tag cap') $$) = 1,
  'the author can detach a tag');
select t.raises($$ insert into public.post_tags (post_id, tag_id)
                   select p.id, '50000000-0000-0000-0000-000000000001' from public.posts p where p.plain_text = 'tag cap' $$,
  'the same tag cannot be attached twice', '23505');
select t.ok(t.rows($$ insert into public.post_tags (post_id, tag_id)
                      select p.id, '50000000-0000-0000-0000-000000000006' from public.posts p where p.plain_text = 'tag cap' $$) = 1,
  'after detaching one, another can be attached');
select t.raises($$ insert into public.post_tags (post_id, tag_id)
                   select p.id, '50000000-0000-0000-0000-000000000005' from public.posts p where p.plain_text = 'tag cap' $$,
  'the cap applies again at 5', '23514');
select t.raises($$ insert into public.post_tags (post_id, tag_id) values ('60000000-0000-0000-0000-0000000000a1', gen_random_uuid()) $$,
  'an unknown tag cannot be attached', '23503');
select t.raises($$ update public.post_tags set tag_id = '50000000-0000-0000-0000-000000000007' where post_id = '60000000-0000-0000-0000-0000000000a1' $$,
  'post_tags rows are never updated, only attached and detached', '42501');
rollback;

-- only the post's author attaches and detaches
begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.raises($$ insert into public.post_tags (post_id, tag_id) values ('60000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000002') $$,
  'another user cannot attach a tag to a public post', '42501');
select t.raises($$ insert into public.post_tags (post_id, tag_id) values ('60000000-0000-0000-0000-0000000000a2', '50000000-0000-0000-0000-000000000002') $$,
  'nor to a private post', '42501');
select t.ok(t.rows($$ delete from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a1' $$) = 0,
  'another user cannot detach tags from a public post');
select t.ok(t.rows($$ delete from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a2' $$) = 0, 'nor from a private post');
select t.ok(t.rows($$ insert into public.post_tags (post_id, tag_id) values ('60000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000003') $$) = 1,
  'but they can tag their own post');
reset role;
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a1') = 2, 'A''s public post keeps its tags');
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a2') = 2, 'A''s private post keeps its tags');

select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.raises($$ insert into public.post_tags (post_id, tag_id) values ('60000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000006') $$,
  'the reverse also holds: A cannot tag B''s post', '42501');
select t.ok(t.rows($$ delete from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000b1' $$) = 0, 'nor detach from it');
select t.ok(t.rows($$ delete from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a1' and tag_id = '50000000-0000-0000-0000-000000000003' $$) = 1,
  'the author detaches from their own post');
rollback;

begin;
set local role anon;
select t.raises($$ insert into public.post_tags (post_id, tag_id) values ('60000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000002') $$,
  'anon cannot attach tags', '42501');
select t.raises($$ delete from public.post_tags $$, 'anon cannot detach tags', '42501');
rollback;

-- post_tags follow the post's visibility
begin;
set local role anon;
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a1') = 2, 'anon sees the tags of a public post');
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a2') = 0, 'but not those of a private post');
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a3') = 0, 'nor of a removed post');
select t.ok((select count(*) from public.post_tags) = 6, 'anon sees the 6 post_tags of the three public posts and nothing else');
rollback;

begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a1') = 2, 'another user sees the tags of a public post');
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a2') = 0, 'but not those of A''s private post');
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000b2') = 1, 'while their own private post shows its tags');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a2') = 2, 'the author sees the tags of their private post');
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000b2') = 0, 'but not those of B''s private post');
rollback;

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
select t.ok((select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 2, 'fixtures: a1 has 2 comments counted');
select t.ok((select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000a2') = 1, 'fixtures: a2 has 1 comment counted');
select t.ok((select sum(comment_count) from public.posts where id not in ('60000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a2')) = 0,
  'fixtures: the other posts have none');

-- reading
begin;
set local role anon;
select t.ok((select count(*) from public.comments where post_id = '60000000-0000-0000-0000-0000000000a1') = 2, 'anon can read comments on a public post');
select t.ok((select count(*) from public.comments where post_id = '60000000-0000-0000-0000-0000000000a2') = 0, 'but not on a private post');
select t.ok((select count(*) from public.comments) = 2, 'anon sees nothing else');
select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a1', 'anon says hi') $$,
  'anon cannot comment', '42501');
select t.raises($$ delete from public.comments $$, 'anon cannot delete comments', '42501');
rollback;

begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.comments where post_id = '60000000-0000-0000-0000-0000000000a2') = 0,
  'another user does not see the comments on a private post');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.comments where post_id = '60000000-0000-0000-0000-0000000000a2') = 1,
  'the author sees the comments on their private post');
rollback;

-- who can comment where
begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000c1', 'nice source');
select t.ok((select author from public.comments where body = 'nice source') = :B, 'the author defaults to the caller');
select t.ok((select parent_id from public.comments where body = 'nice source') is null, 'a comment is top-level by default');
select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a2', 'sneaky') $$,
  'cannot comment on someone else''s private post', '42501');
select t.raises($$ insert into public.comments (post_id, body) values (gen_random_uuid(), 'void') $$,
  'cannot comment on a post that does not exist', '42501');
select t.raises($$ insert into public.comments (post_id, author, body)
                   values ('60000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'forged') $$,
  'cannot comment as someone else', '42501');
select t.raises($$ insert into public.comments (post_id, body, created_at) values ('60000000-0000-0000-0000-0000000000c1', 'backdated', '2000-01-01') $$,
  'created_at is not client-writable', '42501');
select t.raises($$ update public.comments set body = 'edited' where body = 'nice source' $$,
  'comments cannot be edited, not even by their author', '42501');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a2', 'second note to self');
select t.ok((select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000a2') = 2,
  'the author can comment on their own private post');
select t.ok(t.rows($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000c1', 'a signed-in user comments') $$) = 1,
  'a signed-in user can comment on a public post');
rollback;

-- body rules
begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000c1', repeat('x', 1000)) $$) = 1,
  'a 1000 character comment is fine');
select t.ok(t.rows($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000c1', 'x') $$) = 1,
  'a one character comment is fine');
select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000c1', repeat('x', 1001)) $$,
  'a comment over 1000 characters is rejected', '23514');
select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000c1', '') $$,
  'an empty comment is rejected', '23514');
select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000c1', '    ') $$,
  'a whitespace-only comment is rejected', '23514');
select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000c1', null) $$,
  'a comment needs a body', '23502');
rollback;

-- replies: one level, same post
begin;
select set_config('request.jwt.claims', json_build_object('sub', :C::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ insert into public.comments (post_id, parent_id, body)
                      values ('60000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-000000000001', 'me too') $$) = 1,
  'a reply to a top-level comment is fine');
select t.ok((select parent_id from public.comments where body = 'me too') = '70000000-0000-0000-0000-000000000001', 'and it keeps its parent');
select t.raises($$ insert into public.comments (post_id, parent_id, body)
                   values ('60000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-000000000002', 'reply to a reply') $$,
  'a reply to a reply is rejected', '23514');
select t.raises($$ insert into public.comments (post_id, parent_id, body)
                   values ('60000000-0000-0000-0000-0000000000b1', '70000000-0000-0000-0000-000000000001', 'wrong post') $$,
  'a parent from another post is rejected', '23514');
select t.raises($$ insert into public.comments (post_id, parent_id, body)
                   values ('60000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 'orphan') $$,
  'a parent that does not exist is rejected', '23514');
rollback;

-- counters and deletion rights, on a post without comments (b1)
begin;
select t.ok((select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000b1') = 0, 'precondition: b1 has no comments');
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000b1', 'c1 from A');
select t.ok((select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000b1') = 1, 'a comment raises comment_count');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :C::text)::text, true);
set local role authenticated;
insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000b1', 'c2 from C');
insert into public.comments (post_id, parent_id, body)
  values ('60000000-0000-0000-0000-0000000000b1', (select id from public.comments where body = 'c1 from A'), 'reply from C');
select t.ok((select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000b1') = 3, 'replies count too');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ delete from public.comments where body in ('c2 from C', 'reply from C') $$) = 0,
  'a third user cannot delete other people''s comments (even in a thread they started)');
select t.ok((select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000b1') = 3, 'so nothing was uncounted');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :C::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ delete from public.comments where body = 'c2 from C' $$) = 1, 'a comment''s author can delete it');
select t.ok((select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000b1') = 2, 'a delete lowers comment_count');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ delete from public.comments where body = 'c1 from A' $$) = 1, 'the post''s author can delete somebody else''s comment');
select t.ok((select count(*) from public.comments where post_id = '60000000-0000-0000-0000-0000000000b1') = 0,
  'deleting a comment deletes its replies');
select t.ok((select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000b1') = 0,
  'the cascaded reply is uncounted as well');
rollback;

-- ---------------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------------
begin;
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 0, 'precondition: no likes yet');
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;

insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a1');
select t.ok((select user_id from public.likes) = :B, 'user_id defaults to the caller');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 1, 'a like raises like_count');
select t.raises($$ insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a1') $$,
  'the same user cannot like twice', '23505');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 1, 'and the failed like was not counted');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :C::text)::text, true);
set local role authenticated;
insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a1');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 2, 'likes from different users add up');
select t.ok((select count(*) from public.likes) = 1, 'a user sees only their own like rows');
select t.ok(t.rows($$ delete from public.likes where user_id = '00000000-0000-0000-0000-00000000000b' $$) = 0, 'and cannot delete somebody else''s like');
select t.raises($$ update public.likes set created_at = now() $$, 'likes are never updated', '42501');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.likes) = 0, 'the post''s author cannot see who liked it');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 2, 'but sees the count');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ delete from public.likes where post_id = '60000000-0000-0000-0000-0000000000a1' $$) = 1, 'a user can unlike');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 1, 'unliking lowers like_count');
insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a1');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 2, 'and the user can like again');

select t.raises($$ insert into public.likes (post_id, user_id)
                   values ('60000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000a') $$,
  'cannot like on behalf of another user', '42501');
select t.raises($$ insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a2') $$,
  'cannot like a private post of someone else', '42501');
select t.raises($$ insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a3') $$,
  'cannot like a removed post', '42501');
select t.raises($$ insert into public.likes (post_id) values (gen_random_uuid()) $$, 'cannot like a post that does not exist', '42501');
reset role;
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a2') = 0, 'the rejected likes were not counted');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a2') $$) = 1,
  'an author can like their own private post');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a2') = 1, 'and it is counted');
rollback;

begin;
set local role anon;
select t.raises($$ select * from public.likes $$, 'anon cannot read likes', '42501');
select t.raises($$ insert into public.likes (post_id, user_id) values ('60000000-0000-0000-0000-0000000000a1', gen_random_uuid()) $$,
  'anon cannot like', '42501');
rollback;

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
insert into public.favorites (post_id) values ('60000000-0000-0000-0000-0000000000a1');
select t.ok((select user_id from public.favorites) = :B, 'user_id defaults to the caller');
select t.ok((select count(*) from public.favorites) = 1, 'the owner sees their favorite');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 0, 'a favorite is not a like');
select t.raises($$ insert into public.favorites (post_id) values ('60000000-0000-0000-0000-0000000000a1') $$,
  'the same post cannot be favorited twice', '23505');
select t.raises($$ insert into public.favorites (post_id, user_id)
                   values ('60000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000a') $$,
  'cannot favorite on behalf of another user', '42501');
select t.raises($$ insert into public.favorites (post_id) values ('60000000-0000-0000-0000-0000000000a2') $$,
  'cannot favorite a private post of someone else', '42501');
select t.raises($$ insert into public.favorites (post_id) values ('60000000-0000-0000-0000-0000000000a3') $$,
  'cannot favorite a removed post', '42501');
select t.raises($$ update public.favorites set created_at = now() $$, 'favorites are never updated', '42501');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.favorites) = 0, 'other users, the post''s author included, do not see it');
select t.ok(t.rows($$ delete from public.favorites $$) = 0, 'and cannot delete it');
insert into public.favorites (post_id) values ('60000000-0000-0000-0000-0000000000a2');
select t.ok((select count(*) from public.favorites) = 1, 'an author can favorite their own private post');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ delete from public.favorites $$) = 1, 'the owner can remove a favorite');
select t.ok((select count(*) from public.favorites) = 0, 'it is gone');
rollback;

begin;
set local role anon;
select t.raises($$ select * from public.favorites $$, 'anon cannot read favorites', '42501');
select t.raises($$ insert into public.favorites (post_id, user_id) values ('60000000-0000-0000-0000-0000000000a1', gen_random_uuid()) $$,
  'anon cannot favorite', '42501');
rollback;

-- ---------------------------------------------------------------------------
-- tag follows
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :C::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.tag_follows) = 1, 'a user sees only their own follows (C follows Celeste)');
insert into public.tag_follows (tag_id) values ('50000000-0000-0000-0000-000000000001');
select t.ok((select count(*) from public.tag_follows) = 2, 'a user can follow a tag');
select t.ok((select user_id from public.tag_follows where tag_id = '50000000-0000-0000-0000-000000000001') = :C, 'user_id defaults to the caller');
select t.raises($$ insert into public.tag_follows (tag_id) values ('50000000-0000-0000-0000-000000000001') $$,
  'a tag cannot be followed twice', '23505');
select t.raises($$ insert into public.tag_follows (tag_id, user_id)
                   values ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a') $$,
  'cannot follow on behalf of another user', '42501');
select t.raises($$ insert into public.tag_follows (tag_id) values (gen_random_uuid()) $$, 'cannot follow an unknown tag', '23503');
select t.raises($$ update public.tag_follows set created_at = now() $$, 'follows are never updated', '42501');
select t.ok(t.rows($$ delete from public.tag_follows where user_id = '00000000-0000-0000-0000-00000000000a' $$) = 0,
  'cannot unfollow for somebody else');
select t.ok(t.rows($$ delete from public.tag_follows where tag_id = '50000000-0000-0000-0000-000000000001' $$) = 1, 'a user can unfollow');
select t.ok((select count(*) from public.tag_follows) = 1, 'and the other follow is still there');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.tag_follows) = 2, 'A sees their own two follows and none of the others''');
select t.ok(t.rows($$ delete from public.tag_follows $$) = 2, 'a blanket delete only reaches their own rows');
reset role;
select t.ok((select count(*) from public.tag_follows) = 3, 'B''s and C''s follows survive');
rollback;

begin;
set local role anon;
select t.raises($$ select * from public.tag_follows $$, 'anon cannot read follows', '42501');
select t.raises($$ insert into public.tag_follows (tag_id, user_id) values ('50000000-0000-0000-0000-000000000001', gen_random_uuid()) $$,
  'anon cannot follow', '42501');
rollback;

-- ---------------------------------------------------------------------------
-- get_tag
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select t.ok((select count(*) from public.get_tag('bebop001')) = 1, 'anon can look a tag up by slug');
select t.ok((select name from public.get_tag('bebop001')) = 'Cowboy Bebop'
        and (select kind from public.get_tag('bebop001')) = 'anime'
        and (select external ->> 'bangumi' from public.get_tag('bebop001')) = '1'
        and (select created_by from public.get_tag('bebop001')) = :A,
  'get_tag returns the tag''s details');
select t.ok((select id from public.get_tag('bebop001')) = '50000000-0000-0000-0000-000000000001', 'and its id');
select t.ok((select count(*) from public.get_tag('nope')) = 0, 'an unknown slug returns nothing');
select t.ok((select count(*) from public.get_tag('')) = 0, 'an empty slug returns nothing');
select t.ok((select count(*) from public.get_tag(null)) = 0, 'a null slug returns nothing');
select t.ok((select count(*) from public.get_tag('BEBOP001')) = 0, 'slugs are matched exactly');

select t.ok((select post_count from public.get_tag('bebop001')) = 1,
  'post_count counts public posts only (Bebop also has a private and a removed one)');
select t.ok((select post_count from public.get_tag('tetris01')) = 0, 'a tag with only private and removed posts counts none');
select t.ok((select post_count from public.get_tag('hades001')) = 2, 'a tag on two public posts counts two');
select t.ok((select post_count from public.get_tag('dune0001')) = 1, 'a private post of someone else does not count either');
select t.ok((select post_count from public.get_tag('under001')) = 0, 'a tag nobody used has no posts');
select t.ok((select follower_count from public.get_tag('bebop001')) = 2, 'follower_count counts all followers');
select t.ok((select follower_count from public.get_tag('celeste1')) = 3, 'even though the follow rows are private');
select t.ok((select follower_count from public.get_tag('hades001')) = 0, 'a tag without followers has none');
rollback;

-- the counts are the same for a signed-in user who sees less of the follow table
begin;
select set_config('request.jwt.claims', json_build_object('sub', :C::text)::text, true);
set local role authenticated;
select t.ok((select count(*) from public.tag_follows where tag_id = '50000000-0000-0000-0000-000000000001') = 0, 'C does not follow Bebop and cannot see who does');
select t.ok((select follower_count from public.get_tag('bebop001')) = 2, 'but follower_count still says 2');
select t.ok((select post_count from public.get_tag('bebop001')) = 1, 'and post_count still ignores the private and removed posts');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select post_count from public.get_tag('bebop001')) = 1, 'the author of the private post sees the same public count');
rollback;

-- the counts move with the data
begin;
update public.posts set visibility = 'private' where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select post_count from public.get_tag('bebop001')) = 0, 'making the only public post private empties the count');
update public.posts set visibility = 'public' where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select post_count from public.get_tag('bebop001')) = 1, 'and making it public again restores it');
update public.posts set removed_at = now() where id = '60000000-0000-0000-0000-0000000000a1';
select t.ok((select post_count from public.get_tag('bebop001')) = 0, 'a takedown removes it from the count');
update public.posts set removed_at = null where id in ('60000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-0000000000a3');
select t.ok((select post_count from public.get_tag('bebop001')) = 2, 'restoring posts counts them again (a1 and the previously removed a3)');
delete from public.posts where id = '60000000-0000-0000-0000-0000000000a3';
select t.ok((select post_count from public.get_tag('bebop001')) = 1, 'deleting a post lowers the count');

select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
insert into public.posts (body, plain_text) values ('{}', 'a second public bebop post');
insert into public.post_tags (post_id, tag_id)
  select id, '50000000-0000-0000-0000-000000000001' from public.posts where plain_text = 'a second public bebop post';
select t.ok((select post_count from public.get_tag('bebop001')) = 2, 'a new public post with the tag adds to the count');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
delete from public.tag_follows where tag_id = '50000000-0000-0000-0000-000000000001';
select t.ok((select follower_count from public.get_tag('bebop001')) = 1, 'unfollowing lowers follower_count');
insert into public.tag_follows (tag_id) values ('50000000-0000-0000-0000-000000000001');
select t.ok((select follower_count from public.get_tag('bebop001')) = 2, 'and following raises it');
rollback;

-- ---------------------------------------------------------------------------
-- list_tags
-- ---------------------------------------------------------------------------
begin;
set local role anon;

-- ordering
select t.ok(t.tag_names() = array['Hades', 'Celeste', 'Cowboy Bebop', 'jazz', 'Dune', 'back\slash', 'AXB', 'A_B', '100%', 'Tetris'],
  'the default order is hot: public posts first, then followers, then newest');
select t.ok(t.tag_names(null, null, 'hot') = t.tag_names(), 'hot is the default sort');
select t.ok(t.tag_names(null, null, 'new') = array['back\slash', 'AXB', 'A_B', '100%', 'Tetris', 'Celeste', 'Hades', 'jazz', 'Dune', 'Cowboy Bebop'],
  'new orders by creation time, newest first');
select t.ok(t.tag_names(null, 'game', 'hot') = array['Hades', 'Celeste', 'Tetris'],
  'hot: two posts beat three followers');
select t.ok(t.tag_names(null, 'game', 'new') = array['Tetris', 'Celeste', 'Hades'], 'new reverses it');

-- counts in the listing
select t.ok((select post_count from public.list_tags(null, 'anime')) = 1, 'the listing counts public posts only (Bebop has a private and a removed one too)');
select t.ok((select follower_count from public.list_tags(null, 'anime')) = 2, 'and counts all followers, anon cannot even read the follow rows');
select t.ok((select post_count from public.list_tags('tetris')) = 0, 'a tag with only private and removed posts lists 0');
select t.ok((select post_count from public.list_tags('hades')) = 2 and (select follower_count from public.list_tags('celeste')) = 3,
  'two public posts, three followers');
select t.ok((select slug from public.list_tags('bebop')) = 'bebop001'
        and (select description from public.list_tags('bebop')) = ''
        and (select cover_url from public.list_tags('bebop')) is null
        and (select created_at from public.list_tags('bebop')) = '2024-01-10',
  'rows carry slug, description, cover_url and created_at');

-- kind filter
select t.ok(t.tag_names(null, 'anime') = array['Cowboy Bebop'], 'p_kind filters (anime)');
select t.ok(t.tag_names(null, 'book') = array['Dune'], 'p_kind filters (book)');
select t.ok(t.tag_names(null, 'game') <@ array['Hades', 'Celeste', 'Tetris'] and cardinality(t.tag_names(null, 'game')) = 3, 'p_kind filters (game)');
select t.ok(t.tag_names(null, 'film') = '{}', 'a kind with no tags is empty');
select t.ok(t.tag_names(null, 'nonsense') = '{}', 'an unknown kind is empty');
select t.ok(t.tag_names('bebop', 'book') = '{}' and t.tag_names('bebop', 'anime') = array['Cowboy Bebop'], 'p_q and p_kind combine');
select t.ok(cardinality(t.tag_names(null, null)) = 10, 'no kind filter lists plain topics too');

-- name search
select t.ok(t.tag_names('bebop') = array['Cowboy Bebop'], 'p_q matches part of a name');
select t.ok(t.tag_names('BEBOP') = array['Cowboy Bebop'], 'case-insensitively');
select t.ok(t.tag_names('   bebop  ') = array['Cowboy Bebop'], 'ignoring surrounding spaces');
select t.ok(t.tag_names('zzz') = '{}', 'no match, no rows');
select t.ok(cardinality(t.tag_names('')) = 10 and cardinality(t.tag_names('    ')) = 10 and cardinality(t.tag_names(null)) = 10,
  'an empty, blank or null p_q lists everything');
select t.ok(t.tag_names('%') = array['100%'], '% is a literal percent sign, not a wildcard');
select t.ok(t.tag_names('_') = array['A_B'], '_ is a literal underscore, not a wildcard');
select t.ok(t.tag_names('a_b') = array['A_B'], 'a_b does not match AXB');
select t.ok(t.tag_names('\') = array['back\slash'], 'a backslash is literal too');
select t.ok(t.tag_names('k\s') = array['back\slash'], 'also in the middle of a pattern');
select t.ok(t.tag_names('100%') = array['100%'], 'a trailing % is literal');

-- paging
select t.ok(t.tag_names(null, 'game', 'hot', 1) = array['Hades'], 'p_limit limits');
select t.ok(t.tag_names(null, 'game', 'hot', 1, 1) = array['Celeste'], 'p_offset skips');
select t.ok(t.tag_names(null, 'game', 'hot', 2, 2) = array['Tetris'], 'a page can be short');
select t.ok(t.tag_names(null, 'game', 'hot', 5, 3) = '{}', 'past the end is empty');
select t.ok(t.tag_names(null, 'game', 'hot', 0) = array['Hades'], 'a limit of 0 is raised to 1');
select t.ok(t.tag_names(null, 'game', 'hot', -5) = array['Hades'], 'a negative limit is raised to 1');
select t.ok(t.tag_names(null, 'game', 'hot', 10, -3) = array['Hades', 'Celeste', 'Tetris'], 'a negative offset is treated as 0');
select t.ok(cardinality(t.tag_names(null, null, 'new', 1000)) = 10, 'a huge limit is capped but still returns everything here');
select t.ok(t.tag_names(null, null, 'new', 3, 3) = array['100%', 'Tetris', 'Celeste'], 'paging works across the whole list');
rollback;

-- ... and the same for a signed-in user
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok(t.tag_names() = array['Hades', 'Celeste', 'Cowboy Bebop', 'jazz', 'Dune', 'back\slash', 'AXB', 'A_B', '100%', 'Tetris'],
  'a signed-in user gets the same ranking');
select t.ok((select post_count from public.list_tags('bebop')) = 1, 'even though A can see their own private and nothing of the removed post');
select t.ok((select follower_count from public.list_tags('celeste')) = 3 and (select count(*) from public.tag_follows) = 2,
  'follower_count counts others'' follows; the table shows A only their own two');
rollback;

-- ---------------------------------------------------------------------------
-- search_posts
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select t.ok(t.found('opening') = array['a1'], 'anon finds a public post by its text');
select t.ok(t.found('OPENING') = array['a1'], 'case-insensitively');
select t.ok(t.found('  opening ') = array['a1'], 'ignoring surrounding spaces');
select t.ok(t.found('note') = array['a1'], 'and only public ones: the private and the removed "note" are not found');
select t.ok(t.found('secret') = '{}', 'anon cannot find a private post');
select t.ok(t.found('taken') = '{}', 'nor a removed one');
select t.ok(t.found('bebop') = array['a1'], 'anon finds a public post by tag name (the private and removed Bebop posts stay out)');
select t.ok(t.found('tetris') = '{}', 'a tag that is only on private and removed posts finds nothing');
select t.ok(t.found('hades') = array['c1', 'b1'], 'tag matches include posts without text, newest first');
select t.ok(t.found('dune') = array['b1'], 'a post matching both text and tag appears once, and B''s private one is not shown');
select t.ok(t.found('100%') = array['b1'], 'a literal % in the query matches the text');
select t.ok(t.found('%') = array['b1'], '% alone is not a wildcard');
select t.ok(t.found('_') = '{}', '_ alone is not a wildcard');
select t.ok(t.found('\') = '{}', 'a lone backslash is searched literally (and does not error)');
select t.ok(t.found('') = '{}', 'an empty query returns nothing');
select t.ok(t.found('     ') = '{}', 'a blank query returns nothing');
select t.ok(t.found(null) = '{}', 'a null query returns nothing');
select t.ok(t.found('zzzz') = '{}', 'no match, no rows');
rollback;

begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok(t.found('note') = array['a2', 'a1'], 'an author finds their own private post as well, newest first');
select t.ok(t.found('secret') = array['a2'], 'by its text');
select t.ok(t.found('bebop') = array['a2', 'a1'], 'and by its tag');
select t.ok(t.found('tetris') = array['a2'], 'the removed post stays hidden even from its author');
select t.ok(t.found('taken') = '{}', 'also by text');
select t.ok(t.found('dune') = array['b1'], 'but B''s private post is not found');
select t.ok(t.found('private') = '{}', 'nor by its text');
select t.ok(t.found('note', 1) = array['a2'], 'lim limits');
select t.ok(t.found('note', 1, 1) = array['a1'], 'off skips');
select t.ok(t.found('note', 1, 2) = '{}', 'past the end is empty');
select t.ok(t.found('note', 0) = array['a2'], 'a limit of 0 is raised to 1');
select t.ok(t.found('note', 10, -5) = array['a2', 'a1'], 'a negative offset is treated as 0');
select t.ok(t.found('_') = '{}', 'wildcards are escaped for signed-in users too');
rollback;

begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
select t.ok(t.found('dune') = array['b2', 'b1'], 'B finds both of their own dune posts');
select t.ok(t.found('secret') = '{}', 'B cannot find A''s private post');
select t.ok(t.found('bebop') = array['a1'], 'B finds only the public Bebop post');
select t.ok(t.found('%') = array['b1'], '% alone is not a wildcard for B either');
rollback;

-- ---------------------------------------------------------------------------
-- cascades
-- ---------------------------------------------------------------------------

-- deleting an account removes everything it owns, and uncounts it
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'd1@example.com');
insert into public.tags (id, slug, name, created_by) values
  ('50000000-0000-0000-0000-0000000000d1', 'dtag0001', 'Made by D', '00000000-0000-0000-0000-0000000000d1');
insert into public.posts (id, author, body, plain_text) values
  ('60000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', '{}', 'a post by D');
insert into public.post_tags (post_id, tag_id) values
  ('60000000-0000-0000-0000-0000000000d1', '50000000-0000-0000-0000-000000000001');
insert into public.comments (id, post_id, author, body) values
  ('70000000-0000-0000-0000-0000000000d1', '60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'comment by D'),
  ('70000000-0000-0000-0000-0000000000d2', '60000000-0000-0000-0000-0000000000d1', :A, 'A comments on D''s post');
insert into public.likes (post_id, user_id) values
  ('60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1'),
  ('60000000-0000-0000-0000-0000000000d1', :A);
insert into public.favorites (post_id, user_id) values
  ('60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1'),
  ('60000000-0000-0000-0000-0000000000d1', :A);
insert into public.tag_follows (tag_id, user_id) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 1
        and (select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 3,
  'precondition: D''s like and comment are counted on a1');

delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1';

select t.ok((select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d1') = 0, 'the profile is gone');
select t.ok((select count(*) from public.posts where author = '00000000-0000-0000-0000-0000000000d1') = 0, 'their posts are gone');
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000d1') = 0, 'and those posts'' tags');
select t.ok((select count(*) from public.comments where id in ('70000000-0000-0000-0000-0000000000d1', '70000000-0000-0000-0000-0000000000d2')) = 0,
  'their comments are gone, and so are comments on their posts');
select t.ok((select count(*) from public.likes where user_id = '00000000-0000-0000-0000-0000000000d1' or post_id = '60000000-0000-0000-0000-0000000000d1') = 0,
  'their likes are gone, and likes on their posts');
select t.ok((select count(*) from public.favorites where user_id = '00000000-0000-0000-0000-0000000000d1' or post_id = '60000000-0000-0000-0000-0000000000d1') = 0,
  'their favorites too');
select t.ok((select count(*) from public.tag_follows where user_id = '00000000-0000-0000-0000-0000000000d1') = 0, 'and their follows');
select t.ok((select like_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 0
        and (select comment_count from public.posts where id = '60000000-0000-0000-0000-0000000000a1') = 2,
  'other people''s posts lose the counts that came from them');
select t.ok((select count(*) from public.tags where id = '50000000-0000-0000-0000-0000000000d1') = 1
        and (select created_by from public.tags where id = '50000000-0000-0000-0000-0000000000d1') is null,
  'the tags they created stay, without a creator');
select t.ok((select count(*) from public.tags) = 11 and (select count(*) from public.posts) = 6, 'nothing else was touched');
rollback;

-- deleting a post removes what hangs off it
begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
insert into public.likes (post_id) values ('60000000-0000-0000-0000-0000000000a1');
insert into public.favorites (post_id) values ('60000000-0000-0000-0000-0000000000a1');
insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a1', 'about to vanish');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok(t.rows($$ delete from public.posts where id = '60000000-0000-0000-0000-0000000000a1' $$) = 1, 'the author deletes the post');

reset role;
select t.ok((select count(*) from public.post_tags where post_id = '60000000-0000-0000-0000-0000000000a1') = 0, 'its tags are detached');
select t.ok((select count(*) from public.comments where post_id = '60000000-0000-0000-0000-0000000000a1') = 0, 'its comments (and replies) are gone');
select t.ok((select count(*) from public.likes where post_id = '60000000-0000-0000-0000-0000000000a1') = 0, 'its likes are gone');
select t.ok((select count(*) from public.favorites where post_id = '60000000-0000-0000-0000-0000000000a1') = 0, 'its favorites are gone');
select t.ok((select count(*) from public.tags where id in ('50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003')) = 2,
  'the tags themselves stay');
select t.ok((select count(*) from public.posts) = 5, 'and so do the other posts');
rollback;

-- deleting a tag (an operator job: clients cannot) detaches it and drops its follows, but keeps the posts
begin;
delete from public.tags where id = '50000000-0000-0000-0000-000000000005';
select t.ok((select count(*) from public.post_tags where tag_id = '50000000-0000-0000-0000-000000000005') = 0, 'the tag is detached from its posts');
select t.ok((select count(*) from public.tag_follows where tag_id = '50000000-0000-0000-0000-000000000005') = 0, 'its follows are gone');
select t.ok((select count(*) from public.posts where id = '60000000-0000-0000-0000-0000000000c1') = 1, 'the posts stay');
rollback;

-- ---------------------------------------------------------------------------
-- blank-looking text: btrim() only knows the ASCII space, trim_blanks() knows the rest
-- ---------------------------------------------------------------------------
begin;
select t.ok(public.trim_blanks(E' \t\n　 ​﻿ x 　') = 'x', 'trim_blanks strips ASCII, ideographic, no-break and zero-width spaces at both ends');
select t.ok(public.trim_blanks('一　二') = '一　二', 'and leaves spaces inside the text alone');
select t.ok(public.trim_blanks(E'\n\t') = '', 'a text of only blanks becomes empty');

select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;

select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a1', E'\n\t') $$,
  'a comment of only a newline and a tab is empty', '23514');
select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a1', E'　　') $$,
  'a comment of only ideographic spaces is empty', '23514');
select t.raises($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a1', E'​') $$,
  'a comment of only a zero-width space is empty', '23514');
select t.ok(t.rows($$ insert into public.comments (post_id, body) values ('60000000-0000-0000-0000-0000000000a1', E'好　看') $$) = 1,
  'a real comment with an ideographic space inside is fine');

select t.raises($$ insert into public.tags (name) values (E'　') $$, 'a tag named an ideographic space is blank', '23514');
select t.raises($$ insert into public.tags (name) values (E'动漫　') $$, 'a tag name must not end in an ideographic space', '23514');
select t.raises($$ insert into public.tags (name) values (E'​') $$, 'a tag named a zero-width space is blank', '23514');
select t.ok(t.rows($$ insert into public.tags (name) values (E'看　番') $$) = 1, 'a tag with an ideographic space inside is fine');

select t.raises($$ update public.profiles set nickname = E'　' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'a nickname of an ideographic space is blank', '23514');
select t.raises($$ update public.profiles set nickname = E'阿木　' where id = '00000000-0000-0000-0000-00000000000b' $$,
  'a nickname must not end in an ideographic space', '23514');
rollback;
