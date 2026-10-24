# zan

给每一部作品一个研究罐子。

zan 是一个“只存引用，不存内容”的作品笔记站：站点只保存作品、视频 ID、时间点、页码和你自己写的笔记。视频一律用官方播放器嵌入或外链打开，书只记页码和你自己摘的短句（200 字以内）。版权风险最小，存储成本几乎为零。罐子默认私人，想分享时一键发布一份只读快照页。

## 功能

**第一期（MVP）——已实现**

- 邮箱登录（密码或邮件链接，Supabase Auth）
- 从 **Bangumi**（动画、书、漫画、游戏、真人剧）或 **Open Library**（书，可按 ISBN）搜作品，或手动创建，然后建**罐子**
- 往罐子里添加资源：**YouTube**、**B 站**（含分 P、`?t=`、`b23.tv` 短链）、**剧集**（来自 Bangumi 剧集列表）、**书的版本**、任意外链
- 写带锚点的笔记：视频时间段、书的页码 + 摘录、番剧的集数 + 时间码
  - YouTube：`Alt+T` 或“记录当前时间”，把播放器当前时间插成时间戳标签；点击时间戳，播放器跳转
  - B 站：粘贴带 `?t=` 的链接，或手打 `12:34`；点击时间戳时带新的 `t` 重新加载播放器
  - 编辑器内输入 `@12:34`、`p.132`、`E5@12:34` 加空格，自动变成可点击的锚点标签
- **首页即信息流**：打开就是大家公开发布的罐子（按类型筛选、翻页），顶栏和首页顶部随时可以“新建”；没登录点“新建”会先去登录，登录后回到新建页
- **默认私人**：权限落在数据库层（行级权限），前端写错也不会泄漏
- **一键公开**：生成快照（不是改状态），`仅链接可见`（随机地址 + noindex）或 `公开`（进 sitemap）
  - 单条笔记可标记“发布时隐藏”，不会进入快照
  - 发布后继续改私人笔记不会漏到公开页，再点一次“更新快照”才会更新
- **导出 Markdown**：时间锚点导出成 `youtu.be/ID?t=754` / `bilibili.com/video/BV…?t=754` 链接，页码锚点导出成 `p.132`

**第二期——已实现的部分**

- 分享图：发布页自带 OG 图（作品封面 + 标题，中文字体）
- 中文全文搜索：`/search` 跨罐子搜索笔记；默认用 `ILIKE`，在 Supabase 上启用 PGroonga 后换成中文/日文友好的版本（见下文）
- 失效检测：定时检查 YouTube / B 站视频，连续两次判定失效才标记 `dead`（B 站会把被限流的请求答成“找不到”，一次不足为信），播放器换成“视频已失效”占位，笔记保留

**还没做**：标签、浏览器插件（第二期）；发现页和关注、导入 Kindle / 微信读书笔记、多人共建（第三期）。

## 架构

```
浏览器（Next.js）
 ├─ 编辑页：左侧播放器 ｜ 右侧笔记编辑器（TipTap）
 └─ 公开页：只读发布快照 + 嵌入播放器（缓存，发布/取消发布时立即失效）
          │
          ▼
Next.js 服务端（Server Actions / Route Handlers）
 ├─ 链接解析、元数据抓取 ──► YouTube oEmbed / B 站视频信息接口
 ├─ 作品检索 ────────────► Bangumi API / Open Library
 └─ 发布快照、分享图、Markdown 导出
          │
          ▼
Supabase（Postgres + 登录 + 行级权限 RLS + 可选 PGroonga）
```

所有对 Supabase 的访问都发生在服务端（浏览器里没有 Supabase 客户端），登录会话放在 cookie 里。

| 部分 | 选择 |
| --- | --- |
| 前后端 | Next.js 16（App Router，Cache Components）+ TypeScript + Tailwind CSS 4 |
| 数据库与登录 | Supabase：Postgres + Auth + RLS |
| 编辑器 | TipTap 3（自定义“锚点标签”节点），内容存成 JSON |
| 分享图 | `next/og`（即 `@vercel/og`） |
| 测试 | Vitest（单元）+ 纯 SQL 测试（schema 与 RLS） |

## 快速开始

需要 Node.js 20.9+ 和一个 Supabase 项目。

```bash
npm install
cp .env.example .env.local   # 填入 SUPABASE_URL、SUPABASE_ANON_KEY 等
```

1. 在 Supabase 的 SQL Editor 里依次运行 [`0001_init.sql`](supabase/migrations/0001_init.sql) 和 [`0003_public_feed.sql`](supabase/migrations/0003_public_feed.sql)（首页信息流，都必需）；如果要中文友好的搜索，再运行 [`0002_pgroonga_search.sql`](supabase/migrations/0002_pgroonga_search.sql)（也可以用 `supabase db push`，它会按编号顺序全部执行）。
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

启动后用固定的开发账号登录：邮箱 `dev@zan.local`，密码见 [`scripts/dev/mock-supabase.mjs`](scripts/dev/mock-supabase.mjs) 顶部的 `DEV_PASSWORD`（可用环境变量 `ZAN_DEV_EMAIL` / `ZAN_DEV_PASSWORD` 改）。网关重启会忘掉其他账号的密码，开发账号不会。第一次启动还会给它放三个已公开的示例罐子，让首页信息流不是空的（`ZAN_DEV_SEED=0` 跳过；它们只在账号一个罐子都没有时才会生成）。以后新增的迁移再运行这个脚本时会自动补上。

如果用的是下载的 PostgREST 二进制，它链接的是 Homebrew 的 libpq；没装的话用 `LIBPQ_DIR=/opt/homebrew/opt/postgresql@16/lib scripts/dev/local-stack.sh` 指向任意 libpq 5。

它只用于开发（密码存在内存里、没有邮件和限流），不要暴露到网络。

### 环境变量

见 [`.env.example`](.env.example)。必需的只有 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`。

| 变量 | 作用 |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅失效检测定时任务和下架接口使用，绕过 RLS，务必只放服务端 |
| `SITE_URL` | 站点地址（sitemap、分享图、邮件链接） |
| `REPORT_EMAIL` | “举报此页”发往的邮箱 |
| `BANGUMI_ACCESS_TOKEN`、`ZAN_USER_AGENT` | Bangumi 要求带 User-Agent，也提供 Access Token |
| `YOUTUBE_API_KEY` | 可选：补上视频时长和“是否允许外嵌”（有每日配额） |
| `CRON_SECRET` | `/api/cron/check-sources` 的 Bearer 密钥（Vercel Cron 会自动带上） |
| `ADMIN_SECRET` | `/api/admin/takedown` 的 Bearer 密钥 |

## 测试

```bash
npm test            # 单元测试：链接解析、SSRF 防护、锚点、文档清洗与渲染、Markdown 导出……
npm run test:db     # 在临时 PostgreSQL 库里跑迁移和 RLS 测试（需要本机有 PostgreSQL）
npm run lint && npm run typecheck && npm run build
```

`test:db` 会把 Supabase 的 `auth` schema 和角色用一个小桩替代，所以不需要 Docker；要连 PGroonga 一起测，在装了 PGroonga 的服务器上设 `WITH_PGROONGA=1`。

## 设计要点

**数据模型**（[`0001_init.sql`](supabase/migrations/0001_init.sql)）

- `works`：全站共享的作品目录，用 Bangumi / Open Library 的外部 ID 去重；目录里的作品标题和封面由服务端向上游重新抓取，不信任客户端提交的内容
- `jars`：一个用户对一部作品的研究空间（`unique (owner, work_id)`），带随机 `slug`
- `sources`：挂在罐子里的视频 / 剧集 / 书的版本，`meta` 存标题、作者、时长、缩略图的快照——视频被删后笔记仍然看得懂
- `notes`：TipTap JSON + `anchor`（统一三种锚点）+ 抽出来的 `plain_text`（给搜索用）
- `publications`：发布快照，公开页只读这张表

**权限**

- `jars` / `sources` / `notes` 全部开启 RLS，只有 owner 能读写；一条笔记只能关联本罐子的资源（复合外键）
- 匿名访客读不了任何表。公开页通过两个 `security definer` 函数读快照：`get_publication(slug)` 和 `list_public_publications()`——后者只列出 `public`，所以 `unlisted` 页面不会被枚举出来
- 首页信息流读 `list_public_feed(kind, limit, offset)`：同样是 `security definer`，只返回 `public` 快照里卡片需要的几个字段（作品、类型、笔记数、第一条有内容的笔记），不返回整份快照
- `publications` 不能被直接写入：快照只能由 `publish_jar()` 在数据库里生成（owner 校验、`hide_on_publish` 过滤、版本号加一都在这一个事务里），拥有者也无法伪造快照

**防 XSS**

笔记没有任何“原始 HTML”节点。写入时服务端用白名单（`src/lib/doc/schema.ts`）清洗 TipTap JSON：只保留已知节点、标记和属性，链接只允许 `http(s)` / `mailto`；渲染（编辑页的笔记卡片和公开页）用同一套白名单从 JSON 生成转义过的 HTML。

**平台与外部接口**

- YouTube：标题、作者、缩略图走 oEmbed（不需要 key）；嵌入用 `youtube-nocookie.com`，通过 IFrame Player API 读取当前时间和跳转。上传者关闭外嵌或视频私享时，自动降级为外链
- B 站：元数据走非官方的 `x/web-interface/view`，会被 412 / `-352` 拦截，所以服务端有缓存和限速，抓不到时退回让用户手填标题。官方播放器没有 JS 接口，点击时间戳时带新的 `t` 重新加载 iframe，并且默认 `autoplay=0`
- `b23.tv` 短链在服务端手动跟随跳转，**每一跳**都检查目标域名在白名单里（SSRF 防护）；分享图抓取封面时同样只允许已知图床
- CSP 的 `frame-src` 只放行 `www.youtube-nocookie.com` 和 `player.bilibili.com`（见 [`next.config.ts`](next.config.ts)）；每个播放器下面都有“在原站打开”兜底链接

**公开页缓存**

`/p/[slug]` 和首页信息流都使用 `'use cache'`，发布 / 取消发布 / 删除罐子时用 `updateTag` 立即失效页面、分享图、sitemap 和信息流；公开流量不会打到数据库。首页只有信息流部分在请求时渲染（读 `?kind=`、`?page=`），外壳是静态的。

## 部署

- **Vercel**：导入仓库，设置上面的环境变量即可；[`vercel.json`](vercel.json) 里配置了每天一次的失效检测。注意 Vercel 免费档只允许非商业用途
- **Supabase** 免费项目长时间不活跃会被暂停；有稳定用户后再升级
- 内存里的缓存和限流（`src/lib/server/`）是单实例的，多实例部署时换成 Redis / KV 即可

### 运维

- **下架**：`POST /api/admin/takedown`，`Authorization: Bearer $ADMIN_SECRET`，body `{"slug":"…"}`。删除快照、罐子退回私人，页面立即从缓存中失效。流程和条款模板见 `/terms`（上线前请按所在地区法律修改；运营主体在美国时可登记 DMCA 指定代理人）
- **失效检测**：`GET /api/cron/check-sources`，每次检查最久没检查过的 30 个 YouTube / B 站资源。平台没有给出可信答案时（限流、反爬页面）保持原状态；连续两次判定失效（`sources.fail_count`）才标记为 `dead`，之后再次检查到正常会自动恢复
- **中文搜索**：在 Supabase 启用 `pgroonga` 扩展后运行 `0002_pgroonga_search.sql`；`search_notes` 签名不变，应用无需改动

## 已知限制

- B 站播放器读不到当前时间：只能手输或粘贴带 `?t=` 的链接；以后的浏览器插件可以直接读页面里 `video` 元素的 `currentTime`
- B 站接口是非官方的，随时可能变化
- 共享作品目录没有审核：任何登录用户都可以手动创建条目（目录条目来自 Bangumi / Open Library 时标题由服务端抓取）
- 每个用户的罐子 / 笔记数量没有配额

## 许可

[MIT](LICENSE) © zjffun
