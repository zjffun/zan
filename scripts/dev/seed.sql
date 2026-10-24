-- Sample content for the local dev account, so the home feed is not empty on a
-- fresh database. Run by scripts/dev/local-stack.sh (skip it with ZAN_DEV_SEED=0).
-- It does nothing once the account owns a jar, so restarts never duplicate it.
--
--   psql -v email=dev@zan.local -f scripts/dev/seed.sql
--
-- Everything below goes through the real tables and publish_jar() as the
-- account itself, i.e. with row level security on, the way the app does it.

\set ON_ERROR_STOP on

insert into auth.users (email) values (:'email') on conflict (email) do nothing;
select id as dev_id from auth.users where email = :'email' \gset
select not exists (select 1 from public.jars where owner = :'dev_id') as fresh \gset

\if :fresh
begin;
select set_config('request.jwt.claims', json_build_object('sub', :'dev_id')::text, true);
set local role authenticated;

insert into public.works (id, kind, title, title_original) values
  ('de000000-0000-4000-8000-000000000001', 'book',  '三体',         'The Three-Body Problem'),
  ('de000000-0000-4000-8000-000000000002', 'anime', '孤独摇滚！',   'ぼっち・ざ・ろっく！'),
  ('de000000-0000-4000-8000-000000000003', 'game',  '艾尔登法环',   'ELDEN RING');

insert into public.jars (id, work_id) values
  ('de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001'),
  ('de100000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000002'),
  ('de100000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000003');

insert into public.sources (id, jar_id, provider, ref, meta) values
  ('de200000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', 'book',
   '{"edition":"示例版本"}', '{"title":"三体（示例版本）"}'),
  ('de200000-0000-4000-8000-000000000002', 'de100000-0000-4000-8000-000000000002', 'episode',
   '{"ep":5}', '{"title":"第 5 集"}'),
  ('de200000-0000-4000-8000-000000000003', 'de100000-0000-4000-8000-000000000003', 'link',
   '{"url":"https://example.com/"}', '{"title":"示例链接"}');

-- these are samples that show how notes look, not claims about the works
insert into public.notes (jar_id, source_id, anchor, body, plain_text) values
  ('de100000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000001', '{"page":132}',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"示例笔记：在 "},{"type":"anchorChip","attrs":{"page":132}},{"type":"text","text":" 记下你自己的理解，而不是复制原文。导出 Markdown 时它会变成 p.132。"}]}]}',
   '示例笔记：在 p.132 记下你自己的理解，而不是复制原文。导出 Markdown 时它会变成 p.132。'),
  ('de100000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000001',
   '{"page":210,"quote":"这里放你自己摘的短句，200 字以内。"}',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"摘录只是引用：短句加页码，想法写在下面。"}]}]}',
   '摘录只是引用：短句加页码，想法写在下面。'),
  ('de100000-0000-4000-8000-000000000002', 'de200000-0000-4000-8000-000000000002', '{"ep":5,"t":754}',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"示例笔记：番剧记“第几集 + 时间码”，比如 "},{"type":"anchorChip","attrs":{"ep":5,"t":754}},{"type":"text","text":"。"}]}]}',
   '示例笔记：番剧记“第几集 + 时间码”，比如 E5 12:34。'),
  ('de100000-0000-4000-8000-000000000003', 'de200000-0000-4000-8000-000000000003', null,
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"示例笔记：游戏、网页、任何外链都可以作为资源挂在罐子里，笔记不必有锚点。"}]}]}',
   '示例笔记：游戏、网页、任何外链都可以作为资源挂在罐子里，笔记不必有锚点。');

select slug from public.publish_jar('de100000-0000-4000-8000-000000000001', 'public');
select slug from public.publish_jar('de100000-0000-4000-8000-000000000002', 'public');
select slug from public.publish_jar('de100000-0000-4000-8000-000000000003', 'public');
commit;
\endif
