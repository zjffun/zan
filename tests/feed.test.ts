import { describe, expect, it } from "vitest";
import { FEED_MAX_PAGE, feedExcerpt, feedHref, parseFeedQuery } from "@/lib/feed";

const paragraph = (...content: object[]) => ({ type: "doc", content: [{ type: "paragraph", content }] });
const text = (value: string) => ({ type: "text", text: value });

describe("parseFeedQuery", () => {
  it("defaults to every kind, first page", () => {
    expect(parseFeedQuery({})).toEqual({ kind: null, page: 1 });
  });

  it("accepts a known kind and a page number", () => {
    expect(parseFeedQuery({ kind: "book", page: "3" })).toEqual({ kind: "book", page: 3 });
  });

  it("falls back for anything it does not know", () => {
    expect(parseFeedQuery({ kind: "music" }).kind).toBeNull();
    expect(parseFeedQuery({ kind: "__proto__" }).kind).toBeNull();
    for (const page of ["0", "-2", "1.5", "abc", "", "NaN", "Infinity"]) {
      expect(parseFeedQuery({ page }).page, page).toBe(1);
    }
  });

  it("caps the page so a crafted URL cannot ask for an absurd offset", () => {
    expect(parseFeedQuery({ page: "99999999" }).page).toBe(FEED_MAX_PAGE);
  });

  it("uses the first value of a repeated parameter", () => {
    expect(parseFeedQuery({ kind: ["game", "book"], page: ["2", "5"] })).toEqual({ kind: "game", page: 2 });
  });
});

describe("feedHref", () => {
  it("leaves the defaults out", () => {
    expect(feedHref({ kind: null, page: 1 })).toBe("/");
    expect(feedHref({ kind: "anime", page: 1 })).toBe("/?kind=anime");
    expect(feedHref({ kind: null, page: 2 })).toBe("/?page=2");
    expect(feedHref({ kind: "manga", page: 4 })).toBe("/?kind=manga&page=4");
  });
});

describe("feedExcerpt", () => {
  it("is empty when there is no note", () => {
    expect(feedExcerpt(null)).toBe("");
    expect(feedExcerpt(undefined)).toBe("");
    expect(feedExcerpt({ type: "doc", content: [] })).toBe("");
  });

  it("flattens a note to one line and keeps the anchor chips readable", () => {
    const doc = paragraph(text("看 "), { type: "anchorChip", attrs: { page: 132 } }, text("\n\n  的时候想到的"));
    expect(feedExcerpt(doc)).toBe("看 p.132 的时候想到的");
  });

  it("cuts long notes on a character boundary", () => {
    const long = "字".repeat(300);
    const excerpt = feedExcerpt(paragraph(text(long)));
    expect(Array.from(excerpt)).toHaveLength(141);
    expect(excerpt.endsWith("…")).toBe(true);

    // an emoji is one character, never half of a surrogate pair
    const emoji = feedExcerpt(paragraph(text("😀".repeat(200))));
    expect(emoji).toBe(`${"😀".repeat(140)}…`);
  });

  it("does not trust the stored document: unknown nodes are dropped", () => {
    const hostile = {
      type: "doc",
      content: [
        { type: "script", content: [text("alert(1)")] },
        { type: "paragraph", content: [text("fine")] },
      ],
    };
    expect(feedExcerpt(hostile)).toBe("fine");
    expect(feedExcerpt("not a document")).toBe("");
  });
});
