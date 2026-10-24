import { describe, expect, it } from "vitest";
import { anchorLabel, compareAnchors, MAX_QUOTE_LENGTH, parseAnchor } from "@/lib/anchor";

describe("anchor schema", () => {
  it("accepts the three shapes from the design", () => {
    expect(parseAnchor({ t: 754, t_end: 760 })).toEqual({ t: 754, t_end: 760 });
    expect(parseAnchor({ page: 132, quote: "a short line" })).toEqual({ page: 132, quote: "a short line" });
    expect(parseAnchor({ ep: 5, t: 754 })).toEqual({ ep: 5, t: 754 });
  });

  it("treats null/undefined as no anchor", () => {
    expect(parseAnchor(null)).toBeNull();
    expect(parseAnchor(undefined)).toBeNull();
  });

  it("rejects anchors without a locator", () => {
    expect(() => parseAnchor({})).toThrow();
    expect(() => parseAnchor({ quote: "only a quote" })).toThrow();
  });

  it("rejects unknown keys, bad ranges and reversed times", () => {
    expect(() => parseAnchor({ t: 1, evil: "<script>" })).toThrow();
    expect(() => parseAnchor({ page: 0 })).toThrow();
    expect(() => parseAnchor({ t: -1 })).toThrow();
    expect(() => parseAnchor({ t: 10, t_end: 5 })).toThrow();
    expect(() => parseAnchor({ t_end: 5 })).toThrow();
    expect(() => parseAnchor({ percent: 120 })).toThrow();
  });

  it("keeps quotes short so they stay citations", () => {
    expect(() => parseAnchor({ page: 1, quote: "x".repeat(MAX_QUOTE_LENGTH) })).not.toThrow();
    expect(() => parseAnchor({ page: 1, quote: "x".repeat(MAX_QUOTE_LENGTH + 1) })).toThrow();
    // counted in code points, like Postgres: 200 emoji fit, 201 do not
    expect(() => parseAnchor({ page: 1, quote: "😀".repeat(200) })).not.toThrow();
    expect(() => parseAnchor({ page: 1, quote: "😀".repeat(201) })).toThrow();
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
