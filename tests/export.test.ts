import { describe, expect, it } from "vitest";
import { exportJarMarkdown } from "@/lib/export/markdown";
import { parseSnapshot } from "@/lib/snapshot";
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

describe("exportJarMarkdown", () => {
  const out = exportJarMarkdown({
    work: { kind: "anime", title: "星际牛仔", title_original: "Cowboy Bebop", external: { bangumi: "253" } },
    sources: [yt, bili, book],
    notes: [
      { source_id: "s1", anchor: { t: 900 }, body: doc(para(text("后面的 "), chip({ t: 754 }), text(" 才是重点"))) },
      { source_id: "s1", anchor: { t: 754, t_end: 760 }, body: doc(para(text("这里的转场"))) },
      { source_id: "s1", anchor: null, body: doc(para(text("整体感想"))) },
      { source_id: "s3", anchor: { page: 132, quote: "一句话摘录" }, body: doc(para(text("我的想法"))) },
      { source_id: null, anchor: null, body: doc(para(text("游离的笔记"))) },
    ],
    exportedAt: "2026-10-24",
  });

  it("matches the expected document", () => {
    expect(out).toBe(`# 星际牛仔

_Cowboy Bebop · 动画_ — [Bangumi](https://bgm.tv/subject/253)

## 资源

- [OP 解析](https://youtu.be/dQw4w9WgXcQ) — YouTube · 某某 · 12:34
- [第二集 · P2](https://www.bilibili.com/video/BV1GJ411x7h7?p=2) — 哔哩哔哩 · 已失效
- 中文版 — 书

## 笔记

### OP 解析

- **[12:34–12:40](https://youtu.be/dQw4w9WgXcQ?t=754)** 这里的转场
- **[15:00](https://youtu.be/dQw4w9WgXcQ?t=900)** 后面的 [12:34](https://youtu.be/dQw4w9WgXcQ?t=754) 才是重点
- 整体感想

### 中文版

- **p.132**

  > 一句话摘录

  我的想法

### 未关联资源

- 游离的笔记

---

导出自 zan · 2026-10-24
`);
  });

  it("never emits raw html from note text", () => {
    const evil = exportJarMarkdown({
      work: { kind: "other", title: "<script>alert(1)</script>", title_original: null, external: {} },
      sources: [],
      notes: [{ source_id: null, anchor: null, body: doc(para(text("<img src=x onerror=alert(1)>"))) }],
    });
    // every "<" is backslash-escaped, so Markdown renderers show it as text
    expect(evil).not.toMatch(/(^|[^\\])</m);
  });

  it("copes with an empty jar", () => {
    const empty = exportJarMarkdown({ work: { kind: "book", title: "空", title_original: null, external: {} }, sources: [], notes: [] });
    expect(empty).toBe("# 空\n\n_书_\n");
  });
});

describe("parseSnapshot", () => {
  const good = {
    schema: 1,
    work: { kind: "book", title: "T", title_original: null, cover_url: null, external: { isbn: "9780441478125" } },
    sources: [{ id: "s1", provider: "youtube", ref: { videoId: "dQw4w9WgXcQ" }, meta: { title: "x" }, status: "ok" }],
    notes: [{ id: "n1", source_id: "s1", anchor: { t: 5 }, body: doc(), updated_at: "2026-01-01T00:00:00Z" }],
  };

  it("parses what publish_jar writes", () => {
    const snap = parseSnapshot(good);
    expect(snap?.work.title).toBe("T");
    expect(snap?.sources).toHaveLength(1);
    expect(snap?.notes[0].anchor).toEqual({ t: 5 });
  });

  it("degrades instead of crashing on bad rows", () => {
    const snap = parseSnapshot({
      ...good,
      work: { ...good.work, kind: "wat" },
      sources: [...good.sources, { id: "x", provider: "tiktok" }, "junk"],
      notes: [{ ...good.notes[0], anchor: { t: -1 } }, 42],
    });
    expect(snap?.work.kind).toBe("other");
    expect(snap?.sources).toHaveLength(1);
    expect(snap?.notes).toHaveLength(1);
    expect(snap?.notes[0].anchor).toBeNull();
  });

  it("rejects things that are not snapshots", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot({})).toBeNull();
    expect(parseSnapshot({ work: { title: "" } })).toBeNull();
  });
});
