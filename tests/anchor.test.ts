import { describe, expect, it } from "vitest";
import { anchorLabel } from "@/lib/anchor";

describe("anchorLabel", () => {
  it("renders compact labels", () => {
    expect(anchorLabel({ t: 754 })).toBe("12:34");
    expect(anchorLabel({ t: 754, t_end: 760 })).toBe("12:34–12:40");
    expect(anchorLabel({ t: 754, t_end: 754 })).toBe("12:34");
    expect(anchorLabel({ page: 132 })).toBe("p.132");
    expect(anchorLabel({ ep: 5, t: 754 })).toBe("E5 12:34");
    expect(anchorLabel({ chapter: "3" })).toBe("ch.3");
    expect(anchorLabel({ percent: 41.26 })).toBe("41.3%");
    expect(anchorLabel({ t: 3723 })).toBe("1:02:03");
  });
});
