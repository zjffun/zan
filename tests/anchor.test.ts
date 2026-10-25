import { describe, expect, it } from "vitest";
import { anchorLabel, anchorsLabel, compareAnchors, MAX_NOTE_LENGTH, MAX_POSITIONS, parseAnchor, readAnchors } from "@/lib/anchor";

describe("anchor schema", () => {
  it("accepts the three shapes from the design", () => {
    expect(parseAnchor({ t: 754, t_end: 760 })).toEqual({ t: 754, t_end: 760 });
    expect(parseAnchor({ page: 132, note: "a short line" })).toEqual({ page: 132, note: "a short line" });
    expect(parseAnchor({ ep: 5, t: 754 })).toEqual({ ep: 5, t: 754 });
  });

  it("treats null/undefined as no anchor", () => {
    expect(parseAnchor(null)).toBeNull();
    expect(parseAnchor(undefined)).toBeNull();
  });

  it("rejects anchors without a locator", () => {
    expect(() => parseAnchor({})).toThrow();
    expect(() => parseAnchor({ note: "only a note" })).toThrow();
  });

  it("rejects unknown keys, bad ranges and reversed times", () => {
    expect(() => parseAnchor({ t: 1, evil: "<script>" })).toThrow();
    expect(() => parseAnchor({ page: 0 })).toThrow();
    expect(() => parseAnchor({ t: -1 })).toThrow();
    expect(() => parseAnchor({ t: 10, t_end: 5 })).toThrow();
    expect(() => parseAnchor({ t_end: 5 })).toThrow();
    expect(() => parseAnchor({ percent: 120 })).toThrow();
  });

  it("keeps notes short so they stay remarks and citations", () => {
    expect(() => parseAnchor({ page: 1, note: "x".repeat(MAX_NOTE_LENGTH) })).not.toThrow();
    expect(() => parseAnchor({ page: 1, note: "x".repeat(MAX_NOTE_LENGTH + 1) })).toThrow();
    // counted in code points, like Postgres: 200 emoji fit, 201 do not
    expect(() => parseAnchor({ page: 1, note: "😀".repeat(200) })).not.toThrow();
    expect(() => parseAnchor({ page: 1, note: "😀".repeat(201) })).toThrow();
  });

  it("no longer takes the old name for a note", () => {
    expect(() => parseAnchor({ page: 1, quote: "old" })).toThrow();
  });
});

describe("anchorLabel", () => {
  it("renders compact labels", () => {
    expect(anchorLabel({ t: 754 })).toBe("12:34");
    expect(anchorLabel({ t: 754, t_end: 760 })).toBe("12:34–12:40");
    expect(anchorLabel({ page: 132 })).toBe("p.132");
    expect(anchorLabel({ ep: 5, t: 754 })).toBe("E5 12:34");
    expect(anchorLabel({ chapter: "3" })).toBe("ch.3");
    expect(anchorLabel({ percent: 41.26 })).toBe("41.3%");
  });
});

describe("compareAnchors", () => {
  it("sorts by episode then position, unanchored last", () => {
    const list = [null, { t: 30 }, { ep: 2, t: 5 }, { ep: 1, t: 90 }, { t: 10 }];
    const sorted = [...list].sort(compareAnchors);
    expect(sorted).toEqual([{ t: 10 }, { t: 30 }, { ep: 1, t: 90 }, { ep: 2, t: 5 }, null]);
  });
});

describe("readAnchors", () => {
  it("reads the list, in order", () => {
    expect(readAnchors([{ t: 5, note: "开场" }, { page: 3 }], null)).toEqual([{ t: 5, note: "开场" }, { page: 3 }]);
  });

  it("drops entries that are not valid instead of failing the whole post", () => {
    expect(readAnchors([{ t: 5 }, { evil: 1 }, "x", null, { t: -1 }, { page: 2, note: "x".repeat(201) }], null)).toEqual([{ t: 5 }]);
    expect(readAnchors("nope", null)).toEqual([]);
    expect(readAnchors({ t: 5 }, null)).toEqual([]);
  });

  it("falls back to the old single position of a post from before the list, and renames its quote", () => {
    expect(readAnchors([], { page: 132, quote: "摘一句" })).toEqual([{ page: 132, note: "摘一句" }]);
    expect(readAnchors(undefined, { t: 754, t_end: 760 })).toEqual([{ t: 754, t_end: 760 }]);
    expect(readAnchors([], { quote: "no locator" })).toEqual([]);
    expect(readAnchors([], null)).toEqual([]);
    expect(readAnchors([], "x")).toEqual([]);
  });

  it("prefers the list over the old position", () => {
    expect(readAnchors([{ t: 9 }], { t: 1 })).toEqual([{ t: 9 }]);
  });

  it("never returns more than the limit", () => {
    expect(readAnchors(Array.from({ length: 50 }, (_, i) => ({ t: i })), null)).toHaveLength(MAX_POSITIONS);
  });
});

describe("anchorsLabel", () => {
  it("names the first position and counts the rest", () => {
    expect(anchorsLabel([])).toBe("");
    expect(anchorsLabel([{ t: 754 }])).toBe("12:34");
    expect(anchorsLabel([{ t: 754 }, { page: 3 }, { ep: 2 }])).toBe("12:34 等 3 处");
  });
});
