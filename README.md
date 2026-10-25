# zan

zan 是“攒”：一个“只存引用，不存内容”的内容社区，看过的、读过的，一点一点攒下来。

在这里你可以直接发一条内容：一段想法，或者一个 B 站 / YouTube 视频、一个链接，再给它挂上标签。标签就是大家聚在一起的地方（像贴吧里的“吧”）：动漫、书、某一部作品、任何话题；内容则像小红书笔记、Threads 帖子一样，每一条都是独立的。

站点只保存标签、视频 ID、时间点、页码，以及用户自己写的文字。视频一律用官方播放器嵌入或外链打开，书只记页码和你自己摘的短句（200 字以内）。版权风险最小，存储成本几乎为零。

## 功能

- **首页是信息流**：打开就是大家发布的内容（瀑布流卡片），可以切到“关注”（你关注的标签下的内容），上面有热门标签；顶栏和首页顶部随时可以“新建”，没登录点“新建”会先去登录，再回到新建页
- **新建分两类**
  - **发布内容**：写文字（支持加粗、列表、链接等），可以贴 **YouTube** / **B 站**（含分 P、`?t=`、`b23.tv` 短链）或任意网页链接，带上位置（视频时间、集数、页码）和一句自己摘的短句；挂 0–5 个标签，选已有的，或现场新建；可见范围是“所有人”或“仅自己可见”（私人草稿）
  - **新建标签**：从 **Bangumi**（动画、书、漫画、游戏、真人剧）或 **Open Library**（书，可按 ISBN）搜一部作品，名字、封面和类型自动带上；或者手动建一个话题标签
- **位置标签**：编辑器里输入 `@12:34`、`p.132`、`E5@12:34` 加空格，自动变成可点击的标签
  - YouTube：`Alt+T` 或“记录当前时间”，把播放器当前时间插进内容；点击时间标签，播放器跳转
  - B 站：粘贴带 `?t=` 的链接，或手打 `12:34`；点击时间标签时带新的 `t` 重新加载播放器
- **标签页**：每个标签有自己的页面（介绍、封面、内容数、关注数、关注按钮、“在这个标签下发布”），`/tags` 可以按类型、热度、名字浏览
- **互动**：点赞、收藏（“我的收藏”）、评论和回复（一层）、关注标签；作者可以删除自己内容下的任何评论
- **作者**：每个人有昵称、简介和主页；在“设置”里修改
- **搜索**：`/search` 同时搜内容和标签，未登录也能用；默认 `ILIKE`，在 Supabase 上启用 PGroonga 后换成中文/日文友好的版本（见下文）
- **分享图**：每条公开内容自带 OG 图（视频缩略图 + 文字，中文字体）
- **导出 Markdown**：在“设置”里把自己的全部内容导出成一个文件；时间锚点导出成 `youtu.be/ID?t=754` / `bilibili.com/video/BV…?t=754` 链接，页码锚点导出成 `p.132`
- **失效检测**：定时检查 YouTube / B 站视频，连续两次判定失效才标记 `dead`（B 站会把被限流的请求答成“找不到”，一次不足为信），播放器换成“视频已失效”占位，文字保留
- 邮箱登录（密码或邮件链接，Supabase Auth）

**还没做**：浏览器插件、导入 Kindle / 微信读书笔记、关注用户、通知、内容编辑历史、标签管理（合并、改名）和审核后台。

## 架构

```
浏览器（Next.js）
 ├─ 信息流 / 标签页 / 内容页 / 主页（公开部分用缓存，发布和删除时立即失效）
 └─ 发布页：播放器 + 编辑器（TipTap）+ 标签选择
          │
          ▼
Next.js 服务端（Server Actions / Route Handlers）
 ├─ 链接解析、元数据抓取 ──► YouTube oEmbed / B 站视频信息接口
 ├─ 作品检索 ────────────► Bangumi API / Open Library
 └─ 内容、标签、评论、点赞等写入，分享图，Markdown 导出
          │
          ▼
Supabase（Postgres + 登录 + 行级权限 RLS + 可选 PGroonga）
```

所有对 Supabase 的访问都发生在服务端（浏览器里没有 Supabase 客户端），登录会话放在 cookie 里。

| 部分 | 选择 |
| --- | --- |
| 前后端 | Next.js 16（App Router，Cache Components）+ TypeScript + Tailwind CSS 4 |
| 数据库与登录 | Supabase：Postgres + Auth + RLS |
| 编辑器 | TipTap 3（自定义“位置标签”节点），内容存成 JSON |
| 分享图 | `next/og`（即 `@vercel/og`） |
| 测试 | Vitest（单元）+ 纯 SQL 测试（schema 与 RLS） |

## 快速开始

需要 Node.js 20.9+ 和一个 Supabase 项目。

```bash
npm install
cp .env.example .env.local   # 填入 SUPABASE_URL、SUPABASE_ANON_KEY 等
```

1. 在 Supabase 的 SQL Editor 里按编号依次运行 [`supabase/migrations/`](supabase/migrations) 里的 `0001`、`0003`、`0004`（也可以用 `supabase db push`）。`0004` 把早期的“每人每部作品一份私人笔记”模型换成现在的标签 + 内容；如果要中文友好的搜索，最后再运行 [`0005_pgroonga_posts.sql`](supabase/migrations/0005_pgroonga_posts.sql)（`0002` 是旧模型的 PGroonga 版本，`0004` 之后用不上，可以跳过）。
2. Authentication → URL Configuration：把 Site URL 设为你的站点地址，并在 Redirect URLs 里加入 `<站点地址>/auth/callback`。想用邮箱+密码注册后立即登录，可以在 Providers → Email 里关掉 “Confirm email”。
3. 运行：

```bash
npm run dev      # http://localhost:3000
```

### 不用 Supabase 账号在本地跑

[`scripts/dev/local-stack.sh`](scripts/dev/local-stack.sh) 用你本机的 PostgreSQL + [PostgREST](https://postgrest.org) + 一个几十行的登录网关，复刻 Supabase 的 `/rest/v1` 和 `/auth/v1`，不需要 Docker：

```bash
brew install postgresql@16 postgrest      # 或从 github.com/PostgREST/postgrest 下载发行版二进制
scripts/dev/local-stack.sh                # 建库、跑迁移，并打印要写进 .env.local 的变量
```

启动后用固定的开发账号登录：邮箱 `dev@zan.local`，密码见 [`scripts/dev/mock-supabase.mjs`](scripts/dev/mock-supabase.mjs) 顶部的 `DEV_PASSWORD`（可用环境变量 `ZAN_DEV_EMAIL` / `ZAN_DEV_PASSWORD` 改）。网关重启会忘掉其他账号的密码，开发账号不会。第一次启动还会放几个标签、几条示例内容（以及两位不能登录的示例作者）和一些评论、点赞，让首页信息流不是空的（`ZAN_DEV_SEED=0` 跳过；它们只在库里一条内容都没有时才会生成）。以后新增的迁移再运行这个脚本时会自动补上；从旧模型升级时，直接删掉本地库 `dropdb zan_dev` 再运行一次最省事。

如果用的是下载的 PostgREST 二进制，它链接的是 Homebrew 的 libpq；没装的话用 `LIBPQ_DIR=/opt/homebrew/opt/postgresql@16/lib scripts/dev/local-stack.sh` 指向任意 libpq 5。

它只用于开发（密码存在内存里、没有邮件和限流），不要暴露到网络。

### 环境变量

见 [`.env.example`](.env.example)。必需的只有 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`。

| 变量 | 作用 |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅失效检测定时任务和下架接口使用，绕过 RLS，务必只放服务端 |
| `SITE_URL` | 站点地址（sitemap、分享图、邮件链接） |
| `REPORT_EMAIL` | “举报”发往的邮箱 |
| `BANGUMI_ACCESS_TOKEN`、`ZAN_USER_AGENT` | Bangumi 要求带 User-Agent，也提供 Access Token |
| `YOUTUBE_API_KEY` | 可选：补上视频时长和“是否允许外嵌”（有每日配额） |
| `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` | 可选：限流计数和“对外部网站的查询缓存”放进 Upstash Redis，让所有服务器实例共享（见下文“限流与查询缓存”）。在 Vercel 市场里加 Upstash Redis 集成会自动设置；旧的 `KV_REST_API_URL` / `KV_REST_API_TOKEN` 名字也认 |
| `CRON_SECRET` | `/api/cron/check-sources` 的 Bearer 密钥（Vercel Cron 会自动带上） |
| `ADMIN_SECRET` | `/api/admin/takedown` 的 Bearer 密钥 |

## 测试

```bash
npm test            # 单元测试：链接解析、SSRF 防护、锚点、文档清洗与渲染、标签名与发帖校验、Markdown 导出……
npm run test:db     # 在临时 PostgreSQL 库里跑迁移和 RLS 测试（需要本机有 PostgreSQL）
npm run lint && npm run typecheck && npm run build
```

`test:db` 会把 Supabase 的 `auth` schema 和角色用一个小桩替代，所以不需要 Docker；要连 PGroonga 一起测，在装了 PGroonga 的服务器上设 `WITH_PGROONGA=1`。

## 设计要点

**数据模型**（[`0004_tags_and_posts.sql`](supabase/migrations/0004_tags_and_posts.sql)）

- `profiles`：每个账号一份公开资料（昵称、简介），注册时由触发器生成默认昵称，昵称不区分大小写唯一
- `tags`：任何人都能建；名字不区分大小写唯一，来自 Bangumi / Open Library 的标签用外部 ID 去重，名字、封面和类型由服务端向上游重新抓取，不信任客户端提交的内容；页面用随机短 `slug` 寻址，所以名字里可以有任何字符
- `posts`：一条独立的内容。`body`（TipTap JSON）+ 抽出来的 `plain_text`（给搜索和卡片摘要用）、可选的 `source`（视频或链接的 ID 与元数据快照，视频被删后内容仍然看得懂）和 `anchor`（时间、页码、集数 + 不超过 200 字的摘录）、`visibility`（`public` / `private`）、点赞数和评论数
- `post_tags`：内容与标签的多对多，每条内容最多 5 个
- `comments`（一层回复）、`likes`、`favorites`、`tag_follows`

**权限**

- 所有表开启 RLS，且授权细到列：客户端写不了点赞数、评论数、下架标记和失效检测状态；点赞数和评论数由 `security definer` 触发器维护，因为别人的点赞会改你的内容，而他们没有改它的权限
- 读是公开的：匿名访客可以读公开内容、标签、资料和评论；私人内容只有作者自己读得到；被下架（`removed_at`）的内容对所有人不可见
- 点赞、收藏、关注是你自己的行，只有你读得到；点赞数和评论数记在内容上，标签的内容数和关注数由 `list_tags()`、`get_tag()` 这两个只返回聚合数字的 `security definer` 函数给出，所以对所有人含义一致（只统计公开内容）
- 空白检查用 `trim_blanks()`，它认得全角空格、不换行空格和零宽字符，不只是 ASCII 空格；“最多 5 个标签”用咨询锁串行化，并发插入也绕不过去

**防 XSS**

内容没有任何“原始 HTML”节点。写入时服务端用白名单（`src/lib/doc/schema.ts`）清洗 TipTap JSON：只保留已知节点、标记和属性，链接只允许 `http(s)` / `mailto`；渲染用同一套白名单从 JSON 生成转义过的 HTML。评论是纯文本，渲染时由 React 转义。

**平台与外部接口**

- YouTube：标题、作者、缩略图走 oEmbed（不需要 key）；嵌入用 `youtube-nocookie.com`，通过 IFrame Player API 读取当前时间和跳转。上传者关闭外嵌或视频私享时，自动降级为外链
- B 站：元数据走非官方的 `x/web-interface/view`，会被 412 / `-352` 拦截，所以服务端有缓存和限速，抓不到时退回让用户手填标题。官方播放器没有 JS 接口，点击时间标签时带新的 `t` 重新加载 iframe，并且默认 `autoplay=0`
- `b23.tv` 短链在服务端手动跟随跳转，**每一跳**都检查目标域名在白名单里（SSRF 防护）；分享图抓取缩略图时同样只允许已知图床
- CSP 的 `frame-src` 只放行 `www.youtube-nocookie.com` 和 `player.bilibili.com`（见 [`next.config.ts`](next.config.ts)）；每个播放器下面都有“在原站打开”兜底链接

**限流与查询缓存**

- 限流（[`ratelimit.ts`](src/lib/server/ratelimit.ts)）：发布、编辑、评论、点赞、贴链接解析、搜作品、建标签、关注、登录这些动作都按用户（登录按 IP）限次数，固定窗口。配了 Redis 就用 `@upstash/ratelimit`，所有实例共享计数；没配，或者 Redis 慢 / 挂了，就退回本实例内存里计数，宁可限得松，也不把人锁在外面
- 查询缓存（[`cache.ts`](src/lib/server/cache.ts) 的 `SharedCache`）：YouTube / B 站的视频信息缓存 1 小时，Bangumi / Open Library 的搜索缓存 10 分钟。先看本实例内存，再看 Redis，都没有才去问对方；有了 Redis，每条答案对整个站点大约每个有效期只问一次对方。拿不到可信答案的结果（被限流、反爬页面）不缓存
- Redis 出问题时：每次调用最多等 1.2 秒；一旦失败，这个实例 30 秒内不再碰 Redis，直接用内存，只有第一个请求要付出超时的代价，之后自动重试
- 它们和下面 Next 的 `'use cache'` 是两回事：`'use cache'` 缓存的是信息流这类自己数据库的查询，默认也是每个实例各自一份；想让它跨实例共享并让 `updateTag` 对所有实例生效，可以以后改用 `'use cache: remote'`

**缓存**

公开信息流、标签页的内容列表和热门标签使用 `'use cache'`，发布 / 编辑 / 删除内容、改昵称时用 `updateTag("feed")` 立即失效；点赞数和评论数在卡片上最多滞后一两分钟。和“谁在看”有关的部分（顶栏、点赞状态、关注状态、私人内容）每次请求都现查，放在 `<Suspense>` 里流式返回，页面外壳是静态的。

## 部署

- **Vercel**：导入仓库，设置上面的环境变量即可；[`vercel.json`](vercel.json) 里配置了每天一次的失效检测。注意 Vercel 免费档只允许非商业用途
- **从本机用命令行部署**（不需要先把 GitHub 仓库连到 Vercel）：`npx vercel login`，`npx vercel link --project <名字>`，用 `printf %s "$值" | npx vercel env add 名字 -e production --sensitive` 逐个写入环境变量，再 `npx vercel deploy --prod`。[`vercel.json`](vercel.json) 把函数放在东京（`hnd1`），和 Supabase 的东京区域同区；换了数据库区域，这里也要改
- **`package-lock.json` 里的下载地址必须是公网源**：锁文件里的 `resolved` 如果指向 Vercel 访问不到的地址，`npm install` 会直接失败。用 `npm install --registry=https://registry.npmjs.org/` 重新生成；`npm test` 里的 `tests/package-lock.test.ts` 会检查每一项都来自 `registry.npmjs.org`
- **Supabase** 免费项目长时间不活跃会被暂停；有稳定用户后再升级
- 限流和对外部网站的查询缓存：无服务器环境下建议配 Upstash Redis（环境变量见上），不配也能跑，但各实例各算各的，限额形同虚设，B 站更容易把我们拦掉
- **登录 cookie**：HttpOnly（页面脚本读不到，浏览器里本来也没有 Supabase 客户端用它），SameSite=Lax，保存 30 天，每次令牌刷新（活跃时最多每小时一次）都会重新写成再 30 天，所以是“连续 30 天不来才掉线”，不是每 30 天登录一次；生产环境（`NODE_ENV=production`）一律加 Secure，所以必须走 https：用 `next start` 在非 localhost 的 http 地址上访问会存不住登录；开发环境（`npm run dev`）跟着请求走，http 的 localhost / 局域网不加 Secure（Safari 和非 localhost 地址会拒收 Secure cookie），经代理的 https 请求看 `x-forwarded-proto`。访问令牌 1 小时过期，刷新令牌默认不过期，想限制“多久不用就掉线”可以在 Supabase 后台设置会话超时

### 运维

- **下架**：`POST /api/admin/takedown`，`Authorization: Bearer $ADMIN_SECRET`，body `{"post":"<内容 id>"}`。内容对所有人（包括作者）立即隐藏并从缓存中失效，不删数据；传 `"restore": true` 可以恢复。流程和条款模板见 `/terms`（上线前请按所在地区法律修改；运营主体在美国时可登记 DMCA 指定代理人）
- **失效检测**：`GET /api/cron/check-sources`，每次检查最久没检查过的 30 条带 YouTube / B 站视频的内容。平台没有给出可信答案时（限流、反爬页面）保持原状态；连续两次判定失效（`posts.source_fail_count`）才标记为 `dead`，之后再次检查到正常会自动恢复
- **中文搜索**：在 Supabase 启用 `pgroonga` 扩展后运行 `0005_pgroonga_posts.sql`；`search_posts` 签名不变，应用无需改动（这份迁移没有在 CI 里测过，需要装了 PGroonga 的库：`WITH_PGROONGA=1 npm run test:db`）

## 已知限制

- B 站播放器读不到当前时间：只能手输或粘贴带 `?t=` 的链接；以后的浏览器插件可以直接读页面里 `video` 元素的 `currentTime`
- B 站接口是非官方的，随时可能变化
- 标签没有审核，也不能改名、合并或删除（只能由运营者在数据库里处理）；任何登录用户都可以新建标签
- 评论只有一层回复，不能编辑；没有举报评论的入口，也没有通知
- 每个用户的内容 / 标签 / 评论数量没有配额，只有每个用户的操作频率限制（配了 Redis 才跨实例生效，见“限流与查询缓存”）

## 许可

[MIT](LICENSE) © zjffun
