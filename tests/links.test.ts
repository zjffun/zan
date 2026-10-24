import { describe, expect, it } from "vitest";
import { parseLink } from "@/lib/links/parse";
import { isAllowedImageUrl } from "@/lib/links/hosts";

const ID = "dQw4w9WgXcQ";

describe("parseLink: YouTube", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, undefined],
    [`https://youtube.com/watch?v=${ID}&list=PL123`, undefined],
    [`https://m.youtube.com/watch?v=${ID}`, undefined],
    [`https://youtu.be/${ID}`, undefined],
    [`https://youtu.be/${ID}?si=abc`, undefined],
    [`https://www.youtube.com/shorts/${ID}`, undefined],
    [`https://www.youtube.com/embed/${ID}`, undefined],
    [`https://www.youtube-nocookie.com/embed/${ID}`, undefined],
    [`https://www.youtube.com/live/${ID}`, undefined],
    [`youtu.be/${ID}`, undefined],
    [`https://www.youtube.com/watch?v=${ID}&t=754`, 754],
    [`https://www.youtube.com/watch?v=${ID}&t=754s`, 754],
    [`https://youtu.be/${ID}?t=12m34s`, 754],
    [`https://www.youtube.com/embed/${ID}?start=90`, 90],
    [`https://www.youtube.com/watch?v=${ID}#t=30`, 30],
  ])("%s", (input, t) => {
    const parsed = parseLink(input);
    expect(parsed).toMatchObject({ provider: "youtube", videoId: ID });
    expect(parsed && "t" in parsed ? parsed.t : undefined).toBe(t);
  });

  it("rejects malformed ids", () => {
    expect(parseLink("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseLink("https://www.youtube.com/watch")).toBeNull();
    expect(parseLink("https://www.youtube.com/")).toBeNull();
  });
});

describe("parseLink: Bilibili", () => {
  const BV = "BV1GJ411x7h7";
  it("recognises BV links, parts and times", () => {
    expect(parseLink(`https://www.bilibili.com/video/${BV}`)).toEqual({ provider: "bilibili", bvid: BV, p: 1 });
    expect(parseLink(`https://www.bilibili.com/video/${BV}/`)).toEqual({ provider: "bilibili", bvid: BV, p: 1 });
    expect(parseLink(`https://www.bilibili.com/video/${BV}?p=2`)).toEqual({ provider: "bilibili", bvid: BV, p: 2 });
    expect(parseLink(`https://www.bilibili.com/video/${BV}?p=2&t=754.3&spm_id_from=333`)).toEqual({
      provider: "bilibili",
      bvid: BV,
      p: 2,
      t: 754,
    });
    expect(parseLink(`https://m.bilibili.com/video/${BV}`)).toMatchObject({ bvid: BV });
    expect(parseLink(`bilibili.com/video/${BV}`)).toMatchObject({ bvid: BV });
    expect(parseLink(BV)).toEqual({ provider: "bilibili", bvid: BV, p: 1 });
  });

  it("falls back to p=1 for nonsense parts", () => {
    expect(parseLink(`https://www.bilibili.com/video/${BV}?p=0`)).toMatchObject({ p: 1 });
    expect(parseLink(`https://www.bilibili.com/video/${BV}?p=abc`)).toMatchObject({ p: 1 });
  });

  it("flags b23.tv short links for server-side resolution", () => {
    expect(parseLink("https://b23.tv/abc123")).toEqual({ provider: "bilibili-short", url: "https://b23.tv/abc123" });
  });

  it("rejects a bilibili page that is not a video", () => {
    expect(parseLink("https://www.bilibili.com/")).toBeNull();
  });
});

describe("parseLink: everything else", () => {
  it("keeps ordinary pages as external links", () => {
    expect(parseLink("https://example.com/a?b=1")).toEqual({ provider: "link", url: "https://example.com/a?b=1" });
  });

  it("does not trust look-alike hosts", () => {
    expect(parseLink(`https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ`)).toMatchObject({ provider: "link" });
    expect(parseLink("https://b23.tv.evil.example/x")).toMatchObject({ provider: "link" });
    expect(parseLink("https://evilbilibili.com/video/BV1GJ411x7h7")).toMatchObject({ provider: "link" });
  });

  it("rejects non-http schemes, credentials and junk", () => {
    expect(parseLink("javascript:alert(1)")).toBeNull();
    expect(parseLink("data:text/html,hi")).toBeNull();
    expect(parseLink("file:///etc/passwd")).toBeNull();
    expect(parseLink("https://user:pw@example.com/")).toBeNull();
    expect(parseLink("")).toBeNull();
    expect(parseLink("two words")).toBeNull();
  });
});

describe("isAllowedImageUrl", () => {
  it("allows the known image hosts over https only", () => {
    expect(isAllowedImageUrl("https://lain.bgm.tv/pic/cover/l/a.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://i0.hdslb.com/bfs/archive/a.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://covers.openlibrary.org/b/id/1-M.jpg")).toBe(true);
    expect(isAllowedImageUrl("http://lain.bgm.tv/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://hdslb.com.evil.example/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://evil.example/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://127.0.0.1/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("not a url")).toBe(false);
  });
});
