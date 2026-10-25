import { describe, expect, it } from "vitest";
import { IMAGE_ONLY_TEXT, MAX_PLAIN_TEXT, MAX_POST_TAGS, prepareComment, preparePost } from "@/lib/post-input";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (t: string) => ({ type: "text", text: t });
const chip = (attrs: Record<string, number>) => ({ type: "anchorChip", attrs });
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const AUTHOR = "00000000-0000-4000-8000-0000000000aa";
const prepare = (raw: unknown) => preparePost(raw, AUTHOR);

const yt = { provider: "youtube", ref: { videoId: "dQw4w9WgXcQ" }, meta: { title: "OP 解析", author: "某某" } };

describe("preparePost", () => {
  it("accepts a plain text post and fills in the defaults", () => {
    const result = prepare({ body: doc(para(text("今天看完了"))) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      plain_text: "今天看完了",
      source: null,
      visibility: "public",
      tagIds: [],
      newTagNames: [],
    });
  });

  it("keeps a video, its time label and the tags", () => {
    const result = prepare({
      body: doc(para(text("看 "), chip({ t: 754 }), text(" 这里"))),
      source: yt,
      visibility: "private",
      tagIds: [uuid(1), uuid(1), uuid(2)],
      newTags: ["#孤独摇滚！", "孤独摇滚！", " 新标签 "],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.source).toEqual({ provider: "youtube", ref: { videoId: "dQw4w9WgXcQ" }, meta: { title: "OP 解析", author: "某某" } });
    expect(result.value.visibility).toBe("private");
    expect(result.value.tagIds).toEqual([uuid(1), uuid(2)]);
    expect(result.value.newTagNames).toEqual(["孤独摇滚！", "新标签"]);
    // the label is searchable
    expect(result.value.plain_text).toBe("看 12:34 这里");
  });

  it("needs something to say or something to point at", () => {
    expect(prepare({ body: doc() }).ok).toBe(false);
    expect(prepare({ body: doc(para(text("   "))) }).ok).toBe(false);
    expect(prepare({ body: doc(), source: yt }).ok).toBe(true);
  });

  it("rejects bad input instead of storing it", () => {
    const body = doc(para(text("x")));
    expect(prepare({ body, source: { provider: "tiktok", ref: {} } }).ok).toBe(false);
    expect(prepare({ body, source: { provider: "youtube", ref: { videoId: "short" } } }).ok).toBe(false);
    // the lists of positions are gone: what an old client still sends is ignored
    expect(prepare({ body, anchors: [{ t: 1 }], anchor: { t: 1 } }).ok).toBe(true);
    expect(prepare({ body, visibility: "friends" }).ok).toBe(false);
    expect(prepare({ body, tagIds: ["not-a-uuid"] }).ok).toBe(false);
    expect(prepare({ body, newTags: ["a#b"] }).ok).toBe(false);
    expect(prepare({ body, newTags: [""] }).ok).toBe(false);
    expect(prepare(null).ok).toBe(false);
  });

  it("limits the number of tags, existing and new together", () => {
    const body = doc(para(text("x")));
    const five = Array.from({ length: MAX_POST_TAGS }, (_, i) => uuid(i + 1));
    expect(prepare({ body, tagIds: five }).ok).toBe(true);
    expect(prepare({ body, tagIds: [...five, uuid(9)] }).ok).toBe(false);
    expect(prepare({ body, tagIds: five.slice(0, 3), newTags: ["a", "b"] }).ok).toBe(true);
    const over = prepare({ body, tagIds: five.slice(0, 3), newTags: ["a", "b", "c"] });
    expect(over.ok).toBe(false);
  });

  it("limits the length of the text", () => {
    const long = prepare({ body: doc(para(text("字".repeat(MAX_PLAIN_TEXT + 1)))) });
    expect(long.ok).toBe(false);
    expect(prepare({ body: doc(para(text("字".repeat(MAX_PLAIN_TEXT)))) }).ok).toBe(true);
  });

  it("does not trust the document: unknown nodes and attributes are dropped", () => {
    const result = prepare({
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

describe("preparePost with images", () => {
  const key = (owner: string, n: number) => `${owner}/00000000-0000-4000-8000-${String(n).padStart(12, "0")}.webp`;
  const img = (k: string) => ({ type: "image", attrs: { key: k } });

  it("accepts the author's own images, and a post that is only pictures", () => {
    const result = prepare({ body: doc(img(key(AUTHOR, 1))) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.plain_text).toBe(IMAGE_ONLY_TEXT);

    const withText = prepare({ body: doc(para(text("看图")), img(key(AUTHOR, 1))) });
    expect(withText.ok && withText.value.plain_text).toBe("看图");
  });

  it("remembers the first picture in reading order, for the feed card", () => {
    const nested = { type: "blockquote", content: [img(key(AUTHOR, 1))] };
    const result = prepare({ body: doc(para(text("先写字")), nested, img(key(AUTHOR, 2))) });
    expect(result.ok && result.value.cover_image).toBe(key(AUTHOR, 1));
    const none = prepare({ body: doc(para(text("没有图"))) });
    expect(none.ok && none.value.cover_image).toBeNull();
  });

  it("allows at most nine images", () => {
    const nine = Array.from({ length: 9 }, (_, i) => img(key(AUTHOR, i)));
    expect(prepare({ body: doc(...nine) }).ok).toBe(true);
    const ten = prepare({ body: doc(...nine, img(key(AUTHOR, 9))) });
    expect(ten).toEqual({ ok: false, error: "每条内容最多 9 张图片。" });
  });

  it("refuses somebody else's images", () => {
    const other = "00000000-0000-4000-8000-0000000000bb";
    expect(prepare({ body: doc(para(text("我的")), img(key(other, 1))) })).toEqual({ ok: false, error: "图片无效，请重新上传。" });
  });

  it("silently drops image nodes that are not keys at all", () => {
    const result = prepare({ body: doc(para(text("文字")), { type: "image", attrs: { key: "https://example.com/x.png" } }) });
    expect(result.ok && JSON.stringify(result.value.body)).not.toContain("example.com");
  });

  it("still asks for something when there is nothing at all", () => {
    expect(prepare({ body: doc({ type: "image", attrs: { key: "https://example.com/x.png" } }) }).ok).toBe(false);
  });
});

describe("prepareComment", () => {
  const paragraph = (...content: object[]) => ({ type: "paragraph", content });
  const text = (value: string, marks?: object[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
  const comment = (...blocks: object[]) => ({ type: "doc", content: blocks });

  it("keeps formatting, quotes, lists and code, and counts the words", () => {
    const result = prepareComment(
      comment(
        paragraph(text("你好 "), text("粗体", [{ type: "bold" }])),
        { type: "blockquote", content: [paragraph(text("引一句"))] },
        { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("一项"))] }] },
        { type: "codeBlock", content: [text("let x = 1")] },
      ),
    );
    expect(result.ok && result.value.text).toBe("你好 粗体\n引一句\n一项\nlet x = 1");
    expect(result.ok && result.value.doc.content?.map((node) => node.type)).toEqual(["paragraph", "blockquote", "bulletList", "codeBlock"]);
  });

  it("leaves out what a comment does not have: pictures, headings, rules", () => {
    const result = prepareComment(
      comment(
        { type: "heading", attrs: { level: 1 }, content: [text("标题")] },
        { type: "horizontalRule" },
        { type: "image", attrs: { key: "u/x.png" } },
        paragraph(text("正文")),
      ),
    );
    expect(result.ok && result.value.doc.content?.map((node) => node.type)).toEqual(["paragraph"]);
  });

  it("turns @12:34 into a time label, like in a post", () => {
    const result = prepareComment(comment(paragraph(text("看 @0:43 这里"))));
    expect(result.ok && result.value.doc.content?.[0].content?.map((node) => node.type)).toEqual(["text", "anchorChip", "text"]);
  });

  it("refuses links that could run script", () => {
    const result = prepareComment(comment(paragraph(text("点我", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))));
    expect(result.ok && result.value.doc.content?.[0].content?.[0].marks).toBeUndefined();
  });

  it("rejects what is empty, not a document, or too long", () => {
    for (const bad of ["", "字", null, undefined, 1, {}, comment(), comment(paragraph()), comment(paragraph(text("   ")))]) {
      expect(prepareComment(bad).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(prepareComment(comment(paragraph(text("字".repeat(1000))))).ok).toBe(true);
    expect(prepareComment(comment(paragraph(text("字".repeat(1001))))).ok).toBe(false);
  });

  it("does not take a deeply nested or huge document", () => {
    let nested: object = paragraph(text("深"));
    for (let i = 0; i < 10; i++) nested = { type: "blockquote", content: [nested] };
    expect(prepareComment(comment(nested)).ok).toBe(false);
    expect(prepareComment(comment(...Array.from({ length: 600 }, () => paragraph(text("行"))))).ok).toBe(false);
  });
});
