import { describe, expect, it } from "vitest";
import { rowsFromAnchors, rowsToAnchors } from "@/lib/position-rows";

const row = (position: string, note = "") => ({ position, note });

describe("rowsToAnchors", () => {
  it("turns each row into a position with its description, in order", () => {
    expect(rowsToAnchors([row("12:34", "开场"), row("E5 12:34", "伏笔"), row("12:34-12:40"), row("p.132"), row("41%", "读到这里")])).toEqual({
      ok: true,
      anchors: [{ t: 754, note: "开场" }, { ep: 5, t: 754, note: "伏笔" }, { t: 754, t_end: 760 }, { page: 132 }, { percent: 41, note: "读到这里" }],
    });
  });

  it("skips rows with nothing in them and trims the rest", () => {
    expect(rowsToAnchors([row(""), row("  ", "  "), row("  12:34  ", "  好  ")])).toEqual({ ok: true, anchors: [{ t: 754, note: "好" }] });
    expect(rowsToAnchors([])).toEqual({ ok: true, anchors: [] });
  });

  it("accepts a pasted video link that has a time", () => {
    expect(rowsToAnchors([row("https://youtu.be/dQw4w9WgXcQ?t=90", "这里")])).toEqual({ ok: true, anchors: [{ t: 90, note: "这里" }] });
  });

  it("names the row that cannot be read", () => {
    const bad = rowsToAnchors([row("12:34"), row("明天", "x")]);
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toMatch(/^第 2 个位置的格式不对。/);
  });

  it("asks for a position when there is only a description", () => {
    expect(rowsToAnchors([row("", "只有描述")])).toEqual({ ok: false, error: "第 1 个位置需要填位置，比如 12:34 或 p.132。" });
  });

  it("limits a description to 200 characters", () => {
    expect(rowsToAnchors([row("p.1", "字".repeat(200))]).ok).toBe(true);
    expect(rowsToAnchors([row("p.1", "字".repeat(201))])).toEqual({ ok: false, error: "第 1 个位置的描述最多 200 字。" });
  });
});

describe("rowsFromAnchors", () => {
  it("gives back what was saved, so that editing a post and saving it changes nothing", () => {
    const saved = [{ t: 754, t_end: 760, note: "转场" }, { ep: 5, t: 90 }, { page: 132, note: "摘一句" }, { chapter: "3" }];
    const rows = rowsFromAnchors(saved);
    expect(new Set(rows.map((r) => r.id)).size).toBe(4); // every row has its own key
    expect(rowsToAnchors(rows)).toEqual({ ok: true, anchors: saved });
  });
});
