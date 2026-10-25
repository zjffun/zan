import { describe, expect, it } from "vitest";
import { clearDraft, DRAFT_MAX_AGE_MS, draftKey, readDraft, writeDraft, type Draft } from "@/lib/draft";

const memory = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
};

const text = (value: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] });
const yt = { provider: "youtube" as const, ref: { videoId: "dQw4w9WgXcQ" }, meta: { title: "OP" } };
const draft = (extra: Partial<Omit<Draft, "savedAt">> = {}): Omit<Draft, "savedAt"> => ({
  body: text("写到一半"),
  source: null,
  title: "",
  tags: [],
  visibility: "public",
  ...extra,
});

describe("drafts", () => {
  it("has a key for a new post and one for each post being edited", () => {
    expect(draftKey()).toBe("zan:draft:new");
    expect(draftKey("abc")).toBe("zan:draft:edit:abc");
  });

  it("gives back what was written", () => {
    const storage = memory();
    const tags = [{ id: "11111111-1111-4111-8111-111111111111", name: "动漫" }, { name: "新标签" }];
    writeDraft(storage, "k", draft({ source: yt, title: "我的标题", tags, visibility: "private" }), 1000);
    expect(readDraft(storage, "k", 2000)).toEqual({ body: text("写到一半"), source: yt, title: "我的标题", tags, visibility: "private", savedAt: 1000 });
  });

  it("forgets a draft that has nothing in it, even if it has tags", () => {
    const storage = memory();
    writeDraft(storage, "k", draft(), 1);
    expect(storage.map.has("k")).toBe(true);
    writeDraft(storage, "k", draft({ body: { type: "doc", content: [] }, tags: [{ name: "只有标签" }] }), 2);
    expect(storage.map.has("k")).toBe(false);
  });

  it("counts a picture or a link as something", () => {
    const storage = memory();
    const picture = { type: "doc", content: [{ type: "image", attrs: { key: "00000000-0000-0000-0000-00000000000a/11111111-1111-1111-1111-111111111111.webp" } }] };
    writeDraft(storage, "a", draft({ body: picture }), 1);
    writeDraft(storage, "b", draft({ body: { type: "doc", content: [] }, source: yt }), 1);
    expect(readDraft(storage, "a", 2)).not.toBeNull();
    expect(readDraft(storage, "b", 2)).not.toBeNull();
  });

  it("forgets a draft after a month", () => {
    const storage = memory();
    writeDraft(storage, "k", draft(), 1000);
    expect(readDraft(storage, "k", 1000 + DRAFT_MAX_AGE_MS)).not.toBeNull();
    expect(readDraft(storage, "k", 1000 + DRAFT_MAX_AGE_MS + 1)).toBeNull();
  });

  it("can be cleared", () => {
    const storage = memory();
    writeDraft(storage, "k", draft(), 1);
    clearDraft(storage, "k");
    expect(readDraft(storage, "k", 2)).toBeNull();
  });

  it("cleans what it reads, since anything can be in a browser's storage", () => {
    const storage = memory();
    const hostile = {
      v: 1,
      savedAt: 1000,
      body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "好", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }, { type: "script" }] },
      source: { provider: "tiktok", ref: {} },
      title: "t".repeat(1000),
      tags: [{ id: "not-a-uuid", name: "有名字" }, { name: "" }, { name: 5 }, "x", ...Array.from({ length: 10 }, (_, i) => ({ name: `标签${i}` }))],
      visibility: "friends",
    };
    storage.setItem("k", JSON.stringify(hostile));
    const read = readDraft(storage, "k", 2000)!;
    expect(read.body.content).toEqual([{ type: "paragraph", content: [{ type: "text", text: "好" }] }]);
    expect(read.source).toBeNull();
    expect(read.title).toHaveLength(300);
    expect(read.tags).toHaveLength(5);
    expect(read.tags[0]).toEqual({ name: "有名字" });
    expect(read.visibility).toBe("public");
  });

  it("reads nothing from what is not a draft", () => {
    const storage = memory();
    for (const raw of ["", "not json", "null", "[]", "5", JSON.stringify({ v: 2, savedAt: 1, body: text("x") }), JSON.stringify({ v: 1, body: text("x") })]) {
      storage.setItem("k", raw);
      expect(readDraft(storage, "k", 2), raw).toBeNull();
    }
  });

  it("does not fail when there is no storage to use", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readDraft(broken, "k")).toBeNull();
    expect(() => writeDraft(broken, "k", draft())).not.toThrow();
    expect(() => clearDraft(broken, "k")).not.toThrow();
  });
});
