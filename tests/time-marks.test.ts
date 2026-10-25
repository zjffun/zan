import { describe, expect, it } from "vitest";
import { findTimeMarks, splitTimeMarks } from "@/lib/doc/time-marks";

describe("findTimeMarks", () => {
  it("finds @12:34, @1:02:03 and E5@12:34, with their position in the text", () => {
    expect(findTimeMarks("@4:16 身份危机")).toEqual([{ index: 0, length: 5, chip: { t: 256 } }]);
    expect(findTimeMarks("看 @1:02:03 这里")).toEqual([{ index: 2, length: 8, chip: { t: 3723 } }]);
    expect(findTimeMarks("E5@12:34")).toEqual([{ index: 0, length: 8, chip: { ep: 5, t: 754 } }]);
    expect(findTimeMarks("e12@0:05")).toEqual([{ index: 0, length: 8, chip: { ep: 12, t: 5 } }]);
    expect(findTimeMarks("@4:16和@10:00")).toHaveLength(2);
  });

  it("accepts the full-width colon that Chinese input methods write", () => {
    expect(findTimeMarks("@4：16 开始")).toEqual([{ index: 0, length: 5, chip: { t: 256 } }]);
  });

  it("works right next to Chinese text, punctuation and the end of the text", () => {
    expect(findTimeMarks("看@4:16。")).toHaveLength(1);
    expect(findTimeMarks("（@4:16）")).toHaveLength(1);
    expect(findTimeMarks("@4:16")).toHaveLength(1);
  });

  it("leaves alone what is not a time mark", () => {
    for (const text of ["name@4:16", "a_b@4:16", "mail me@example.com", "@4:60", "@4:6", "4:16", "@:16", "@4:16:", "@4:161", "@4:16:30:10", "@@", "", "p.132"]) {
      expect(findTimeMarks(text), text).toEqual([]);
    }
    // 49 hours is more than any video
    expect(findTimeMarks("@49:00:00")).toEqual([]);
  });
});

describe("splitTimeMarks", () => {
  it("cuts the text around the marks and keeps every other character", () => {
    expect(splitTimeMarks("前 @4:16 中 E2@0:30 后")).toEqual([
      { text: "前 " },
      { chip: { t: 256 } },
      { text: " 中 " },
      { chip: { ep: 2, t: 30 } },
      { text: " 后" },
    ]);
    expect(splitTimeMarks("没有标记")).toEqual([{ text: "没有标记" }]);
    expect(splitTimeMarks("@4:16")).toEqual([{ chip: { t: 256 } }]);
  });
});
