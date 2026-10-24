-- Sample content for the local dev account, so the home feed is not empty on a
-- fresh database. Run by scripts/dev/local-stack.sh (skip it with ZAN_DEV_SEED=0).
-- It does nothing once there are posts, so restarts never duplicate it.
--
--   psql -v email=dev@zan.local -f scripts/dev/seed.sql
--
-- Runs as a superuser, so row level security does not apply; the triggers do
-- (profiles, like and comment counters). The two other authors cannot sign in.

\set ON_ERROR_STOP on

insert into auth.users (email) values (:'email'), ('xiaoman@zan.local'), ('amu@zan.local') on conflict (email) do nothing;
select id as dev_id from auth.users where email = :'email' \gset
select id as xm_id  from auth.users where email = 'xiaoman@zan.local' \gset
select id as amu_id from auth.users where email = 'amu@zan.local' \gset
select not exists (select 1 from public.posts) as fresh \gset

\if :fresh
begin;

update public.profiles set nickname = '开发者', bio = '本地开发账号' where id = :'dev_id';
update public.profiles set nickname = '小满', bio = '看番，也看书。' where id = :'xm_id';
update public.profiles set nickname = '阿木', bio = '记下时间点的人。' where id = :'amu_id';

insert into public.tags (id, slug, name, kind, description, created_by) values
  ('de000000-0000-4000-8000-000000000001', 'seedtag001', '动漫',       'anime', '看过的、想聊的动画。', :'dev_id'),
  ('de000000-0000-4000-8000-000000000002', 'seedtag002', '书',         'book',  '读书笔记、摘录和书单。', :'dev_id'),
  ('de000000-0000-4000-8000-000000000003', 'seedtag003', '游戏',       'game',  '', :'dev_id'),
  ('de000000-0000-4000-8000-000000000004', 'seedtag004', '孤独摇滚！', 'anime', 'ぼっち・ざ・ろっく！', :'xm_id'),
  ('de000000-0000-4000-8000-000000000005', 'seedtag005', '三体',       'book',  'The Three-Body Problem', :'amu_id'),
  ('de000000-0000-4000-8000-000000000006', 'seedtag006', '读书笔记',   null,    '一边读一边记下页码和想法。', :'amu_id'),
  ('de000000-0000-4000-8000-000000000007', 'seedtag007', '艾尔登法环', 'game',  'ELDEN RING', :'dev_id');

-- These are samples that show how posts look, not claims about the works.
insert into public.posts (id, author, body, plain_text, source, anchor, visibility, created_at) values
  ('de100000-0000-4000-8000-000000000001', :'xm_id',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"示例：番剧记“第几集 + 时间码”，比如 "},{"type":"anchorChip","attrs":{"ep":5,"t":754}},{"type":"text","text":"。点一下标签，播放器就跳到那一刻。"}]}]}',
   '示例：番剧记“第几集 + 时间码”，比如 E5 12:34。点一下标签，播放器就跳到那一刻。',
   null, '{"ep":5,"t":754}', 'public', now() - interval '3 hours'),
  ('de100000-0000-4000-8000-000000000002', :'amu_id',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"示例：书只记页码和你自己摘的短句，想法写在下面。导出 Markdown 时页码会变成 "},{"type":"anchorChip","attrs":{"page":132}},{"type":"text","text":"。"}]}]}',
   '示例：书只记页码和你自己摘的短句，想法写在下面。导出 Markdown 时页码会变成 p.132。' || E'\n' || '这里放你自己摘的短句，200 字以内。',
   null, '{"page":132,"quote":"这里放你自己摘的短句，200 字以内。"}', 'public', now() - interval '2 hours'),
  ('de100000-0000-4000-8000-000000000003', :'dev_id',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"示例：贴一个 B 站或 YouTube 链接，zan 会嵌入官方播放器，在 "},{"type":"anchorChip","attrs":{"t":43}},{"type":"text","text":" 这样的时间标签上点一下就能跳转。"}]}]}',
   '示例：贴一个 B 站或 YouTube 链接，zan 会嵌入官方播放器，在 0:43 这样的时间标签上点一下就能跳转。',
   '{"provider":"youtube","ref":{"videoId":"dQw4w9WgXcQ"},"meta":{"title":"Rick Astley - Never Gonna Give You Up (Official Video)","author":"Rick Astley","thumbnail":"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg","duration":213}}',
   '{"t":43}', 'public', now() - interval '90 minutes'),
  ('de100000-0000-4000-8000-000000000004', :'dev_id',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"示例：游戏、网页、任何外链都可以挂在内容后面，不必有位置标签。"}]}]}',
   '示例：游戏、网页、任何外链都可以挂在内容后面，不必有位置标签。',
   '{"provider":"link","ref":{"url":"https://example.com/"},"meta":{"title":"示例链接"}}',
   null, 'public', now() - interval '1 hour'),
  ('de100000-0000-4000-8000-000000000005', :'dev_id',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"示例：把可见范围选成“仅自己可见”，它就是只有你能看到的草稿。"}]}]}',
   '示例：把可见范围选成“仅自己可见”，它就是只有你能看到的草稿。',
   null, null, 'private', now() - interval '30 minutes');

insert into public.post_tags (post_id, tag_id) values
  ('de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001'),
  ('de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000004'),
  ('de100000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000002'),
  ('de100000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000005'),
  ('de100000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000006'),
  ('de100000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000001'),
  ('de100000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000003'),
  ('de100000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000007'),
  ('de100000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000006');

insert into public.likes (post_id, user_id) values
  ('de100000-0000-4000-8000-000000000001', :'dev_id'),
  ('de100000-0000-4000-8000-000000000001', :'amu_id'),
  ('de100000-0000-4000-8000-000000000002', :'xm_id'),
  ('de100000-0000-4000-8000-000000000003', :'xm_id'),
  ('de100000-0000-4000-8000-000000000003', :'amu_id');

insert into public.favorites (post_id, user_id) values
  ('de100000-0000-4000-8000-000000000002', :'dev_id');

insert into public.tag_follows (tag_id, user_id) values
  ('de000000-0000-4000-8000-000000000001', :'dev_id'),
  ('de000000-0000-4000-8000-000000000006', :'dev_id');

insert into public.comments (id, post_id, parent_id, author, body, created_at) values
  ('de200000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', null, :'amu_id', '这个写法很顺手，输入 @12:34 加空格就变成标签了。', now() - interval '2 hours'),
  ('de200000-0000-4000-8000-000000000002', 'de100000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000001', :'xm_id', '对，Alt+T 还能直接取播放器当前时间。', now() - interval '100 minutes'),
  ('de200000-0000-4000-8000-000000000003', 'de100000-0000-4000-8000-000000000003', null, :'xm_id', '点时间标签会跳到视频里对应的位置。', now() - interval '1 hour');

commit;
\endif
