import { describe, expect, it } from "vitest";
import { firstChipTime } from "@/lib/doc/chips";
import { withLegacyPositions } from "@/lib/doc/legacy-positions";
import type { DocNode } from "@/lib/doc/schema";
import { docToPlainText } from "@/lib/doc/text";

const para = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });
const text = (t: string): DocNode => ({ type: "text", text: t });
const chip = (attrs: Record<string, number>): DocNode => ({ type: "anchorChip", attrs });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });

describe("withLegacyPositions", () => {
  it("returns the text as it is when the post has no list of positions", () => {
    const body = doc(para(text("正文")));
    expect(withLegacyPositions(body, [])).toEqual(body);
  });

  it("puts each position on a line of its own above the text: a label for a time, then its description", () => {
    const out = withLegacyPositions(doc(para(text("正文"))), [{ t: 256, note: "开始介绍" }, { ep: 5, t: 90, note: "转场" }]);
    // an episode that came with the time is written out before it
    expect(out).toEqual(
      doc(para(chip({ t: 256 }), text(" 开始介绍")), para(text("E5 "), chip({ t: 90 }), text(" 转场")), para(text("正文"))),
    );
  });

  it("writes what a label cannot hold (a page, an episode, a range, a chapter, a percentage) as plain text", () => {
    const out = withLegacyPositions(doc(), [
      { page: 132, note: "摘一句" },
      { ep: 5 },
      { t: 754, t_end: 760, note: "转场" },
      { chapter: "3" },
      { percent: 41, note: "读到这里" },
    ]);
    expect(out.content?.map((p) => p.content?.[0])).toEqual([text("p.132"), text("E5"), text("12:34–12:40"), text("ch.3"), text("41%")]);
    expect(docToPlainText(out)).toBe("p.132 摘一句\nE5\n12:34–12:40 转场\nch.3\n41% 读到这里");
  });

  it("copes with a missing or broken text", () => {
    expect(withLegacyPositions(null, [{ page: 1 }])).toEqual(doc(para(text("p.1"))));
    expect(withLegacyPositions("<script>", [])).toEqual(doc());
  });
});

describe("firstChipTime", () => {
  it("is the time of the first time label, wherever it sits", () => {
    expect(firstChipTime(doc(para(text("a"), chip({ t: 90 }), chip({ t: 5 }))))).toBe(90);
    expect(firstChipTime(doc({ type: "blockquote", content: [para(chip({ ep: 2, t: 7 }))] }))).toBe(7);
  });

  it("is undefined without one (a page label has no time)", () => {
    expect(firstChipTime(doc(para(text("a"), chip({ page: 3 }))))).toBeUndefined();
    expect(firstChipTime(doc())).toBeUndefined();
  });
});
