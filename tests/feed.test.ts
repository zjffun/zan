import { describe, expect, it } from "vitest";
import { buildHref, excerptOf, FEED_MAX_PAGE, parseFeedTab, parsePage, teaserOf } from "@/lib/feed";

describe("parsePage", () => {
  it("defaults to the first page and accepts real page numbers", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("3")).toBe(3);
  });

  it("falls back for anything else", () => {
    for (const page of ["0", "-2", "1.5", "abc", "", "NaN", "Infinity"]) expect(parsePage(page), page).toBe(1);
  });

  it("caps the page so a crafted URL cannot ask for an absurd offset", () => {
    expect(parsePage("99999999")).toBe(FEED_MAX_PAGE);
  });

  it("uses the first value of a repeated parameter", () => {
    expect(parsePage(["2", "5"])).toBe(2);
  });
});

describe("parseFeedTab", () => {
  it("knows two tabs and defaults to the latest", () => {
    expect(parseFeedTab("following")).toBe("following");
    expect(parseFeedTab("latest")).toBe("latest");
    expect(parseFeedTab("whatever")).toBe("latest");
    expect(parseFeedTab(undefined)).toBe("latest");
    expect(parseFeedTab(["following", "x"])).toBe("following");
  });
});

describe("buildHref", () => {
  it("leaves the defaults out", () => {
    expect(buildHref("/", {})).toBe("/");
    expect(buildHref("/", { tab: "latest", page: 1 })).toBe("/");
    expect(buildHref("/", { tab: "following" })).toBe("/?tab=following");
    expect(buildHref("/t/abc", { page: 3 })).toBe("/t/abc?page=3");
  });

  it("keeps the other parameters and encodes them", () => {
    expect(buildHref("/search", { q: "孤独 摇滚", page: 2 })).toBe("/search?q=%E5%AD%A4%E7%8B%AC+%E6%91%87%E6%BB%9A&page=2");
    expect(buildHref("/tags", { kind: "book", sort: null, q: "" })).toBe("/tags?kind=book");
  });
});

describe("excerptOf", () => {
  it("is empty when there is no text", () => {
    expect(excerptOf(null)).toBe("");
    expect(excerptOf(undefined)).toBe("");
    expect(excerptOf("  \n ")).toBe("");
  });

  it("flattens whitespace", () => {
    expect(excerptOf("第一行\n\n  第二行")).toBe("第一行 第二行");
  });

  it("cuts long text on a character boundary", () => {
    const excerpt = excerptOf("字".repeat(300));
    expect(Array.from(excerpt)).toHaveLength(141);
    expect(excerpt.endsWith("…")).toBe(true);
    // an emoji is one character, never half of a surrogate pair
    expect(excerptOf("😀".repeat(200))).toBe(`${"😀".repeat(140)}…`);
    expect(excerptOf("abcdef", 3)).toBe("abc…");
  });
});

describe("teaserOf", () => {
  it("is empty when there is no text", () => {
    expect(teaserOf(null)).toBe("");
    expect(teaserOf(" \n \n")).toBe("");
  });

  it("keeps the lines of a post as lines, with their own spaces tidied", () => {
    expect(teaserOf("第一行\n\n  第二   行\n第三行")).toBe("第一行\n第二 行\n第三行");
  });

  it("cuts on a character boundary and does not leave a space before the dots", () => {
    expect(teaserOf("字".repeat(300))).toBe(`${"字".repeat(140)}…`);
    expect(teaserOf("abc def", 4)).toBe("abc…");
    expect(teaserOf("😀".repeat(200))).toBe(`${"😀".repeat(140)}…`);
  });
});
