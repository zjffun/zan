import { describe, expect, it } from "vitest";
import { MAX_PLAIN_TEXT, MAX_POST_TAGS, normalizeComment, preparePost } from "@/lib/post-input";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (t: string) => ({ type: "text", text: t });
const chip = (attrs: Record<string, number>) => ({ type: "anchorChip", attrs });
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const yt = { provider: "youtube", ref: { videoId: "dQw4w9WgXcQ" }, meta: { title: "OP 解析", author: "某某" } };

describe("preparePost", () => {
  it("accepts a plain text post and fills in the defaults", () => {
    const result = preparePost({ body: doc(para(text("今天看完了"))) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      plain_text: "今天看完了",
      anchor: null,
      source: null,
      visibility: "public",
      tagIds: [],
      newTagNames: [],
    });
  });

  it("keeps a video, its position and the tags", () => {
    const result = preparePost({
      body: doc(para(text("看 "), chip({ t: 754 }), text(" 这里"))),
      source: yt,
      anchor: { t: 754, quote: "一句话" },
      visibility: "private",
      tagIds: [uuid(1), uuid(1), uuid(2)],
      newTags: ["#孤独摇滚！", "孤独摇滚！", " 新标签 "],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.source).toEqual({ provider: "youtube", ref: { videoId: "dQw4w9WgXcQ" }, meta: { title: "OP 解析", author: "某某" } });
    expect(result.value.anchor).toEqual({ t: 754, quote: "一句话" });
    expect(result.value.visibility).toBe("private");
    expect(result.value.tagIds).toEqual([uuid(1), uuid(2)]);
    expect(result.value.newTagNames).toEqual(["孤独摇滚！", "新标签"]);
    // the label and the quote are searchable
    expect(result.value.plain_text).toBe("看 12:34 这里\n一句话");
  });

  it("needs something to say or something to point at", () => {
    expect(preparePost({ body: doc() }).ok).toBe(false);
    expect(preparePost({ body: doc(para(text("   "))) }).ok).toBe(false);
    expect(preparePost({ body: doc(), source: yt }).ok).toBe(true);
    expect(preparePost({ body: doc(), anchor: { page: 132 } }).ok).toBe(true);
  });

  it("rejects bad input instead of storing it", () => {
    const body = doc(para(text("x")));
    expect(preparePost({ body, source: { provider: "tiktok", ref: {} } }).ok).toBe(false);
    expect(preparePost({ body, source: { provider: "youtube", ref: { videoId: "short" } } }).ok).toBe(false);
    expect(preparePost({ body, anchor: { t: -1 } }).ok).toBe(false);
    expect(preparePost({ body, anchor: { page: 1, quote: "字".repeat(201) } }).ok).toBe(false);
    expect(preparePost({ body, visibility: "friends" }).ok).toBe(false);
    expect(preparePost({ body, tagIds: ["not-a-uuid"] }).ok).toBe(false);
    expect(preparePost({ body, newTags: ["a#b"] }).ok).toBe(false);
    expect(preparePost({ body, newTags: [""] }).ok).toBe(false);
    expect(preparePost(null).ok).toBe(false);
  });

  it("limits the number of tags, existing and new together", () => {
    const body = doc(para(text("x")));
    const five = Array.from({ length: MAX_POST_TAGS }, (_, i) => uuid(i + 1));
    expect(preparePost({ body, tagIds: five }).ok).toBe(true);
    expect(preparePost({ body, tagIds: [...five, uuid(9)] }).ok).toBe(false);
    expect(preparePost({ body, tagIds: five.slice(0, 3), newTags: ["a", "b"] }).ok).toBe(true);
    const over = preparePost({ body, tagIds: five.slice(0, 3), newTags: ["a", "b", "c"] });
    expect(over.ok).toBe(false);
  });

  it("limits the length of the text", () => {
    const long = preparePost({ body: doc(para(text("字".repeat(MAX_PLAIN_TEXT + 1)))) });
    expect(long.ok).toBe(false);
    expect(preparePost({ body: doc(para(text("字".repeat(MAX_PLAIN_TEXT)))) }).ok).toBe(true);
  });

  it("does not trust the document: unknown nodes and attributes are dropped", () => {
    const result = preparePost({
      body: doc(
        { type: "script", content: [text("alert(1)")] },
        para(text("fine"), { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }),
      ),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value.body)).not.toContain("script");
    expect(JSON.stringify(result.value.body)).not.toContain("javascript:");
    expect(result.value.plain_text).toBe("finelink");
  });
});

describe("normalizeComment", () => {
  it("trims and squeezes blank lines", () => {
    expect(normalizeComment("  你好  ")).toBe("你好");
    expect(normalizeComment("一\r\n\r\n\r\n\r\n二")).toBe("一\n\n二");
  });

  it("rejects empty, blank and too long comments", () => {
    for (const bad of ["", "   ", "\n\t", "　", 1, null, undefined]) expect(normalizeComment(bad), String(bad)).toBeNull();
    expect(normalizeComment("字".repeat(1000))).not.toBeNull();
    expect(normalizeComment("字".repeat(1001))).toBeNull();
  });
});
