import { describe, expect, it } from "vitest";
import { formatTimestamp, parseClock, parseTimeParam } from "@/lib/time";

describe("formatTimestamp", () => {
  it("formats minutes and hours", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(754)).toBe("12:34");
    expect(formatTimestamp(3723)).toBe("1:02:03");
    expect(formatTimestamp(754.9)).toBe("12:34");
    expect(formatTimestamp(-5)).toBe("0:00");
  });
});

describe("parseClock", () => {
  it("parses clock strings", () => {
    expect(parseClock("12:34")).toBe(754);
    expect(parseClock("0:05")).toBe(5);
    expect(parseClock("1:02:03")).toBe(3723);
    expect(parseClock("90:00")).toBe(5400);
  });
  it("rejects things that are not clocks", () => {
    expect(parseClock("12")).toBeNull();
    expect(parseClock("12:60")).toBeNull();
    expect(parseClock("1:75:00")).toBeNull();
    expect(parseClock("a:bc")).toBeNull();
    expect(parseClock("99:99:99")).toBeNull();
  });
});

describe("parseTimeParam", () => {
  it("parses URL time parameters", () => {
    expect(parseTimeParam("754")).toBe(754);
    expect(parseTimeParam("754.9")).toBe(754);
    expect(parseTimeParam("754s")).toBe(754);
    expect(parseTimeParam("12m34s")).toBe(754);
    expect(parseTimeParam("1h2m3s")).toBe(3723);
    expect(parseTimeParam("2m")).toBe(120);
  });
  it("rejects garbage", () => {
    expect(parseTimeParam("")).toBeNull();
    expect(parseTimeParam(null)).toBeNull();
    expect(parseTimeParam("abc")).toBeNull();
    expect(parseTimeParam("-5")).toBeNull();
    expect(parseTimeParam("9999999")).toBeNull();
  });
});
