import { describe, expect, it } from "vitest";
import { formatDate, formatRelative, formatTimestamp, parseClock, parseTimeParam } from "@/lib/time";

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

describe("formatRelative", () => {
  const now = Date.parse("2026-10-25T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  it("says how long ago, in the unit that fits", () => {
    expect(formatRelative(ago(5_000), now)).toBe("刚刚");
    expect(formatRelative(ago(59_999), now)).toBe("刚刚");
    expect(formatRelative(ago(minute), now)).toBe("1 分钟前");
    expect(formatRelative(ago(59 * minute), now)).toBe("59 分钟前");
    expect(formatRelative(ago(hour), now)).toBe("1 小时前");
    expect(formatRelative(ago(23 * hour + 59 * minute), now)).toBe("23 小时前");
    expect(formatRelative(ago(day), now)).toBe("1 天前");
    expect(formatRelative(ago(6 * day + 23 * hour), now)).toBe("6 天前");
  });

  it("gives the date after a week", () => {
    expect(formatRelative(ago(7 * day), now)).toBe(formatDate(ago(7 * day)));
    expect(formatDate("2026-10-24T08:00:00Z")).toBe("2026年10月24日");
  });

  it("does not say anything odd about a time a little in the future", () => {
    expect(formatRelative(new Date(now + 30_000).toISOString(), now)).toBe("刚刚");
  });
});
