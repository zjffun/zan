import { describe, expect, it } from "vitest";
import { AVAILABILITY, BOOKS, BOOK_STAGES } from "@/lib/books/data";
import { bookStatus, isPublic } from "@/lib/books/summary";
import type { Book } from "@/lib/books/types";
import { getScale } from "@/lib/scales";

const book = (resources: Book["resources"]): Book => ({ id: "x", title: "x", stage: "relief", resources });
const resource = (availability: Book["resources"][number]["availability"]) => ({ name: availability, kind: "exercise" as const, availability, note: "n" });

describe("bookStatus", () => {
  it("is public when anything can be had for free, even only for personal use", () => {
    expect(bookStatus(book([resource("none"), resource("free")]))).toBe("public");
    expect(bookStatus(book([resource("paid"), resource("personal")]))).toBe("public");
    expect(bookStatus(book([resource("open")]))).toBe("public");
  });

  it("is paid when the only way in is to buy or ask", () => {
    expect(bookStatus(book([resource("paid"), resource("none")]))).toBe("paid");
  });

  it("is none when everything was looked up and nothing was found", () => {
    expect(bookStatus(book([resource("none"), resource("none")]))).toBe("none");
  });

  it("is unknown when nothing, or not everything, was looked up", () => {
    expect(bookStatus(book([]))).toBe("unknown");
    expect(bookStatus(book([resource("none"), resource("unknown")]))).toBe("unknown");
  });

  it("counts only what is free as public", () => {
    expect((["open", "free", "personal"] as const).every(isPublic)).toBe(true);
    expect((["paid", "none", "unknown"] as const).some(isPublic)).toBe(false);
  });
});

describe("the books catalogue", () => {
  it("gives every book its own id, in a stage that exists", () => {
    const ids = BOOKS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const stages = BOOK_STAGES.map((stage) => stage.id);
    for (const entry of BOOKS) expect(stages).toContain(entry.stage);
  });

  it("has a book in every stage", () => {
    for (const stage of BOOK_STAGES) expect(BOOKS.some((entry) => entry.stage === stage.id)).toBe(true);
  });

  it("links only to https pages", () => {
    for (const entry of BOOKS)
      for (const item of entry.resources)
        for (const link of item.links ?? []) {
          expect(link.url).toMatch(/^https:\/\//);
          expect(link.label.trim()).not.toBe("");
        }
  });

  it("says where the permission is written for everything it calls open or free", () => {
    for (const entry of BOOKS)
      for (const item of entry.resources)
        if (item.availability === "open" || item.availability === "free" || item.availability === "personal") {
          expect(item.links?.length ?? 0, `${entry.title} / ${item.name}`).toBeGreaterThan(0);
        }
  });

  it("points a scale on the site at a scale that exists", () => {
    for (const entry of BOOKS)
      for (const item of entry.resources) if (item.scaleId) expect(getScale(item.scaleId), item.scaleId).toBeDefined();
  });

  it("explains every label it can show, and writes all of it in Chinese", () => {
    for (const value of Object.values(AVAILABILITY)) {
      expect(value.label).toMatch(/[一-鿿]/);
      expect(value.meaning).toMatch(/[一-鿿]/);
    }
    for (const entry of BOOKS) {
      expect(entry.title).toMatch(/[一-鿿]/);
      for (const item of entry.resources) expect(item.note).toMatch(/[一-鿿]/);
    }
  });

  it("does not claim a book's own questionnaire is open when nobody has said so", () => {
    const life = BOOKS.find((entry) => entry.id === "reinventing-your-life")!;
    expect(life.resources.every((item) => item.availability === "none")).toBe(true);
    expect(bookStatus(life)).toBe("none");
  });
});
