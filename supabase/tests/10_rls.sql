-- Schema + row level security tests. Runs as a superuser and switches roles the
-- way PostgREST does (role + request.jwt.claims). Any failed assertion aborts.

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''

create schema t;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ASSERT FAILED: %', msg; end if;
end $$;
create function t.raises(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    return;
  end;
  raise exception 'ASSERT FAILED (expected an error): %', msg;
end $$;
grant usage on schema t to anon, authenticated;

insert into auth.users (id, email) values (:A, 'a@example.com'), (:B, 'b@example.com');

-- ---------------------------------------------------------------------------
-- user A builds a jar
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;

insert into public.works (id, kind, title, external)
  values ('10000000-0000-0000-0000-000000000001', 'anime', 'Cowboy Bebop', '{"bangumi":"1"}');
insert into public.jars (id, work_id)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
insert into public.sources (id, jar_id, provider, ref, meta) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'youtube',
   '{"videoId":"dQw4w9WgXcQ"}', '{"title":"t"}');
insert into public.notes (id, jar_id, source_id, anchor, body, plain_text) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', '{"t":754}',
   '{"type":"doc","content":[]}', 'public note about the opening'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   null, null, '{"type":"doc","content":[]}', 'secret note');
update public.notes set hide_on_publish = true where id = '40000000-0000-0000-0000-000000000002';

select t.ok((select visibility from public.jars) = 'private', 'jars are private by default');
select t.ok((select char_length(slug) from public.jars) = 16, 'slug is generated');
commit;

-- ---------------------------------------------------------------------------
-- constraints
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;

select t.raises($$ insert into public.works (kind, title, external) values ('anime', 'dup', '{"bangumi":"1"}') $$,
  'the same bangumi id cannot be added twice');
select t.raises($$ insert into public.works (kind, title, created_by) values ('anime', 'x', '00000000-0000-0000-0000-00000000000b') $$,
  'cannot add a work on behalf of someone else');
select t.raises($$ insert into public.works (kind, title, cover_url) values ('other', 'x', 'javascript:alert(1)') $$,
  'cover_url must be https');
select t.raises($$ update public.works set title = 'renamed' $$ , 'works are not editable') ;
select t.ok((select title from public.works) = 'Cowboy Bebop', 'work title is unchanged');
select t.raises(format($$ insert into public.notes (jar_id, anchor, body) values ('20000000-0000-0000-0000-000000000001', '{"page":1,"quote":"%s"}', '{}') $$, repeat('x', 201)),
  'quotes over 200 characters are rejected');
select t.raises($$ insert into public.sources (jar_id, provider, ref) values ('20000000-0000-0000-0000-000000000001', 'youtube', '{"videoId":"dQw4w9WgXcQ"}') $$,
  'the same video cannot be added twice to a jar');
select t.raises($$ insert into public.sources (jar_id, provider, ref) values ('20000000-0000-0000-0000-000000000001', 'tiktok', '{}') $$,
  'unknown provider');
rollback;

-- ---------------------------------------------------------------------------
-- user B cannot see or touch A's data
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;

select t.ok((select count(*) from public.jars) = 0,    'B cannot read A''s jars');
select t.ok((select count(*) from public.sources) = 0, 'B cannot read A''s sources');
select t.ok((select count(*) from public.notes) = 0,   'B cannot read A''s notes');
select t.ok((select count(*) from public.works) = 1,   'B can read the shared catalog');
select t.raises($$ insert into public.notes (jar_id, body) values ('20000000-0000-0000-0000-000000000001', '{}') $$,
  'B cannot write notes into A''s jar');
select t.raises($$ insert into public.sources (jar_id, provider, ref) values ('20000000-0000-0000-0000-000000000001', 'link', '{"url":"https://example.com"}') $$,
  'B cannot add sources to A''s jar');
select t.raises($$ select * from public.publish_jar('20000000-0000-0000-0000-000000000001', 'public') $$,
  'B cannot publish A''s jar');
update public.jars set visibility = 'public';
select t.ok((select count(*) from public.search_notes('secret')) = 0, 'B cannot search A''s notes');
rollback;

begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
select t.ok((select visibility from public.jars) = 'private', 'B''s update did not touch A''s jar');
commit;

-- a note cannot point at another jar's source
begin;
select set_config('request.jwt.claims', json_build_object('sub', :B::text)::text, true);
set local role authenticated;
insert into public.works (id, kind, title) values ('10000000-0000-0000-0000-000000000002', 'book', 'B''s book');
insert into public.jars (id, work_id) values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');
select t.raises($$ insert into public.notes (jar_id, source_id, body) values ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '{}') $$,
  'a note cannot reference a source from a different jar');
commit;

-- ---------------------------------------------------------------------------
-- anonymous visitors see nothing private
-- ---------------------------------------------------------------------------
begin;
set local role anon;
select t.raises($$ select * from public.jars $$,         'anon cannot read jars');
select t.raises($$ select * from public.notes $$,        'anon cannot read notes');
select t.raises($$ select * from public.publications $$, 'anon cannot read publications directly');
select t.raises($$ select * from public.publish_jar('20000000-0000-0000-0000-000000000001', 'public') $$,
  'anon cannot publish');
select t.ok((select count(*) from public.get_publication('nope')) = 0, 'unknown slug returns nothing');
rollback;

-- ---------------------------------------------------------------------------
-- publishing
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;

select t.raises($$ insert into public.publications (jar_id, slug, visibility, title, snapshot)
                   values ('20000000-0000-0000-0000-000000000001', 'forged', 'public', 'x', '{}') $$,
  'owners cannot forge a snapshot by writing the table directly');

select t.ok((select version from public.publish_jar('20000000-0000-0000-0000-000000000001', 'unlisted')) = 1, 'first publish is version 1');
select t.ok((select visibility from public.jars) = 'unlisted', 'jar visibility follows publish');
commit;

begin;
set local role anon;
select t.ok((select count(*) from public.get_publication('')) = 0, 'empty slug returns nothing');
commit;

select slug as pub_slug from public.publications \gset

begin;
set local role anon;
select t.ok((select count(*) from public.get_publication(:'pub_slug')) = 1, 'anon can read an unlisted snapshot by slug');
select t.ok((select count(*) from public.list_public_publications()) = 0, 'unlisted pages are not listed');
select t.ok(
  (select jsonb_array_length(snapshot -> 'notes') from public.get_publication(:'pub_slug')) = 1,
  'hide_on_publish notes are not in the snapshot');
select t.ok(
  (select snapshot::text from public.get_publication(:'pub_slug')) not like '%secret note%',
  'hidden note text is nowhere in the snapshot');
select t.ok(
  (select snapshot -> 'notes' -> 0 ->> 'source_id' from public.get_publication(:'pub_slug')) = '30000000-0000-0000-0000-000000000001',
  'notes keep their source');
commit;

-- edits after publishing do not leak into the snapshot
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
update public.notes set plain_text = 'edited later' where id = '40000000-0000-0000-0000-000000000001';
update public.notes set hide_on_publish = false where id = '40000000-0000-0000-0000-000000000002';
select t.ok((select version from public.publish_jar('20000000-0000-0000-0000-000000000001', 'public')) = 2, 'republish bumps the version');
commit;

begin;
set local role anon;
select t.ok((select count(*) from public.list_public_publications()) = 1, 'public pages are listed');
select t.ok(
  (select jsonb_array_length(snapshot -> 'notes') from public.get_publication(:'pub_slug')) = 2,
  'republish picks up the un-hidden note');
rollback;

-- ---------------------------------------------------------------------------
-- search, source deletion, unpublish
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;

select t.ok((select count(*) from public.search_notes('edited')) = 1, 'owner can search their notes');
select t.ok((select count(*) from public.search_notes('100%')) = 0, 'LIKE wildcards are escaped');
select t.ok((select count(*) from public.search_notes('bebop')) = 2, 'search also matches the work title');

delete from public.sources where id = '30000000-0000-0000-0000-000000000001';
select t.ok((select count(*) from public.notes) = 2, 'deleting a source keeps its notes');
select t.ok((select source_id from public.notes where id = '40000000-0000-0000-0000-000000000001') is null,
  'the note is detached from the deleted source');

select public.unpublish_jar('20000000-0000-0000-0000-000000000001');
select t.ok((select count(*) from public.publications) = 0, 'unpublish deletes the snapshot');
select t.ok((select visibility from public.jars) = 'private', 'unpublish makes the jar private again');
commit;

begin;
set local role anon;
select t.ok((select count(*) from public.get_publication(:'pub_slug')) = 0, 'an unpublished page is gone for the public');
select t.ok((select count(*) from public.list_public_publications()) = 0, 'and no longer listed');
rollback;

-- the jar list orders by "last touched": notes and sources bump the jar
begin;
-- jars_touch would overwrite the back-dated value below, so switch it off for this test
alter table public.jars disable trigger jars_touch;
select set_config('request.jwt.claims', json_build_object('sub', :A::text)::text, true);
set local role authenticated;
update public.jars set updated_at = '2020-01-01';
select t.ok((select updated_at from public.jars where id = '20000000-0000-0000-0000-000000000001') < '2021-01-01', 'precondition: back-dated');
insert into public.notes (jar_id, body) values ('20000000-0000-0000-0000-000000000001', '{}');
select t.ok((select updated_at from public.jars where id = '20000000-0000-0000-0000-000000000001') > '2021-01-01', 'adding a note bumps the jar');
update public.jars set updated_at = '2020-01-01';
select t.ok((select updated_at from public.jars where id = '20000000-0000-0000-0000-000000000001') < '2021-01-01', 'precondition: back-dated again');
insert into public.sources (jar_id, provider, ref) values ('20000000-0000-0000-0000-000000000001', 'link', '{"url":"https://example.com"}');
select t.ok((select updated_at from public.jars where id = '20000000-0000-0000-0000-000000000001') > '2021-01-01', 'adding a source bumps the jar');
rollback;
