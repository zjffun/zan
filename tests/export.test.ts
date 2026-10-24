import { describe, expect, it } from "vitest";
import { exportPostsMarkdown } from "@/lib/export/markdown";
import { anchorUrl, sourceTitle, sourceUrl } from "@/lib/sources";

const para = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });
const text = (t: string) => ({ type: "text", text: t });
const chip = (attrs: Record<string, number>) => ({ type: "anchorChip", attrs });

const yt = { id: "s1", provider: "youtube" as const, ref: { videoId: "dQw4w9WgXcQ" }, meta: { title: "OP 解析", author: "某某", duration: 754 } };
const bili = { id: "s2", provider: "bilibili" as const, ref: { bvid: "BV1GJ411x7h7", p: 2 }, meta: { title: "第二集", part: "P2" }, status: "dead" as const };
const book = { id: "s3", provider: "book" as const, ref: { edition: "中文版" }, meta: null };

describe("source links", () => {
  it("builds deep links back to the original site", () => {
    expect(sourceUrl(yt, 754)).toBe("https://youtu.be/dQw4w9WgXcQ?t=754");
    expect(sourceUrl(yt)).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(sourceUrl(yt, 0)).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(sourceUrl(bili, 754)).toBe("https://www.bilibili.com/video/BV1GJ411x7h7?p=2&t=754");
    expect(sourceUrl({ provider: "bilibili", ref: { bvid: "BV1GJ411x7h7", p: 1 } })).toBe("https://www.bilibili.com/video/BV1GJ411x7h7");
    expect(sourceUrl({ provider: "episode", ref: { ep: 5, url: "https://example.com/watch" } })).toBe("https://example.com/watch");
    expect(sourceUrl(book)).toBeNull();
  });

  it("only links time anchors of video sources", () => {
    expect(anchorUrl(yt, { t: 90 })).toBe("https://youtu.be/dQw4w9WgXcQ?t=90");
    expect(anchorUrl(book, { t: 90 })).toBeNull();
    expect(anchorUrl(yt, null)).toBeNull();
    expect(anchorUrl(null, { t: 1 })).toBeNull();
  });

  it("names sources readably", () => {
    expect(sourceTitle(yt)).toBe("OP 解析");
    expect(sourceTitle(bili)).toBe("第二集 · P2");
    expect(sourceTitle({ provider: "youtube", ref: { videoId: "abc" } })).toBe("YouTube abc");
    expect(sourceTitle({ provider: "link", ref: { url: "https://example.com/x" } })).toBe("example.com");
    expect(sourceTitle(book)).toBe("中文版");
  });
});

describe("exportPostsMarkdown", () => {
  const post = (extra: Record<string, unknown>) => ({
    created_at: "2026-10-24T08:00:00Z",
    visibility: "public" as const,
    tags: [],
    source: null,
    anchor: null,
    body: doc(),
    plain_text: "",
    ...extra,
  });

  const out = exportPostsMarkdown({
    posts: [
      post({
        tags: [{ name: "动漫" }, { name: "星际牛仔" }],
        source: { provider: yt.provider, ref: yt.ref, meta: yt.meta },
        anchor: { t: 754, t_end: 760 },
        body: doc(para(text("这里的转场，对照 "), chip({ t: 900 }), text(" 的收尾"))),
        plain_text: "这里的转场，对照 15:00 的收尾",
      }),
      post({
        visibility: "private",
        source: { provider: bili.provider, ref: bili.ref, meta: bili.meta },
        source_status: "dead",
        body: doc(para(text("已经看不了了"))),
        plain_text: "已经看不了了",
      }),
      post({
        tags: [{ name: "读书 笔记" }],
        anchor: { page: 132, quote: "一句话摘录" },
        body: doc(para(text("我的想法"))),
        plain_text: "我的想法",
      }),
    ],
    exportedAt: "2026-10-24",
  });

  it("matches the expected document", () => {
    expect(out).toBe(`# 我在 zan 攒下的内容

## OP 解析

_2026-10-24_

#动漫 #星际牛仔

来源：[OP 解析](https://youtu.be/dQw4w9WgXcQ) — YouTube · 某某 · 12:34

**[12:34–12:40](https://youtu.be/dQw4w9WgXcQ?t=754)**

这里的转场，对照 [15:00](https://youtu.be/dQw4w9WgXcQ?t=900) 的收尾

## 第二集 · P2

_2026-10-24 · 仅自己可见_

来源：[第二集 · P2](https://www.bilibili.com/video/BV1GJ411x7h7?p=2) — 哔哩哔哩 · 已失效

已经看不了了

## 我的想法

_2026-10-24_

#读书\\_笔记

**p.132**

> 一句话摘录

我的想法

---

导出自 zan · 2026-10-24
`);
  });

  it("never emits raw html from post text", () => {
    const evil = exportPostsMarkdown({
      posts: [
        post({
          tags: [{ name: "<b>" }],
          body: doc(para(text("<img src=x onerror=alert(1)>"))),
          plain_text: "<script>alert(1)</script>",
        }),
      ],
    });
    // every "<" is backslash-escaped, so Markdown renderers show it as text
    expect(evil).not.toMatch(/(^|[^\\])</m);
  });

  it("copes with no posts", () => {
    expect(exportPostsMarkdown({ posts: [] })).toBe("# 我在 zan 攒下的内容\n");
  });
});
