import { describe, expect, it } from "vitest";
import { parseAnchorText } from "@/lib/anchor-text";

describe("parseAnchorText", () => {
  it.each([
    ["12:34", { t: 754 }],
    ["  1:02:03 ", { t: 3723 }],
    ["12:34-12:40", { t: 754, t_end: 760 }],
    ["12:34 – 12:40", { t: 754, t_end: 760 }],
    ["E5", { ep: 5 }],
    ["E5 12:34", { ep: 5, t: 754 }],
    ["e5@12:34", { ep: 5, t: 754 }],
    ["ep12", { ep: 12 }],
    ["第5集", { ep: 5 }],
    ["第5集 12:34", { ep: 5, t: 754 }],
    ["p.132", { page: 132 }],
    ["P132", { page: 132 }],
    ["p 7", { page: 7 }],
    ["132页", { page: 132 }],
    ["第132页", { page: 132 }],
    ["ch.3", { chapter: "3" }],
    ["chapter 12", { chapter: "12" }],
    ["第三章", { chapter: "三" }],
    ["41%", { percent: 41 }],
    ["41.5 %", { percent: 41.5 }],
  ])("%s", (input, expected) => {
    expect(parseAnchorText(input)).toEqual(expected);
  });

  it("reads the time out of a pasted video link", () => {
    expect(parseAnchorText("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=754s")).toEqual({ t: 754 });
    expect(parseAnchorText("https://youtu.be/dQw4w9WgXcQ?t=90")).toEqual({ t: 90 });
    expect(parseAnchorText("https://www.bilibili.com/video/BV1GJ411x7h7?p=2&t=754.3")).toEqual({ t: 754 });
    expect(parseAnchorText("youtu.be/dQw4w9WgXcQ?t=90")).toEqual({ t: 90 });
  });

  it("rejects links without a time, other links and nonsense", () => {
    expect(parseAnchorText("https://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(parseAnchorText("https://example.com/?t=5")).toBeNull();
    expect(parseAnchorText("")).toBeNull();
    expect(parseAnchorText("hello")).toBeNull();
    expect(parseAnchorText("12:75")).toBeNull();
    expect(parseAnchorText("12:40-12:34")).toBeNull(); // reversed range
    expect(parseAnchorText("p.0")).toBeNull();
    expect(parseAnchorText("150%")).toBeNull();
  });
});

import { anchorToText } from "@/lib/anchor";

describe("anchorToText", () => {
  it("round-trips through parseAnchorText", () => {
    for (const anchor of [{ t: 754 }, { t: 754, t_end: 760 }, { ep: 5, t: 90 }, { ep: 3 }, { page: 132 }, { chapter: "3" }, { percent: 41.5 }]) {
      expect(parseAnchorText(anchorToText(anchor))).toEqual(anchor);
    }
  });
});
