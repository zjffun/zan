import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/http")>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson, followAllowedRedirects } from "@/lib/server/http";
import { normalizeBilibiliImage, parseIsoDuration, resolveLink } from "@/lib/links/resolve";
import { isAllowedImageRedirectHost, REDIRECT_ALLOWED_HOSTS } from "@/lib/links/hosts";

const mockFetchJson = vi.mocked(fetchJson);

// distinct ids per test: lookups are cached in memory for an hour
let n = 0;
const ytId = () => `yt${String(++n).padStart(9, "0")}`;
const bvId = () => `BV1${String(++n).padStart(9, "0")}`;

beforeEach(() => mockFetchJson.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("resolveLink: YouTube", () => {
  it("adds a normal video with its metadata and start time", async () => {
    const id = ytId();
    mockFetchJson.mockResolvedValueOnce({
      status: 200,
      json: { title: " OP 解析 ", author_name: "某某", thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
    });
    const result = await resolveLink(`https://youtu.be/${id}?t=754`);
    expect(result).toEqual({
      ok: true,
      value: {
        source: {
          provider: "youtube",
          ref: { videoId: id },
          meta: { title: "OP 解析", author: "某某", thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
        },
        t: 754,
        warnings: [],
        needsTitle: false,
      },
    });
  });

  it("drops thumbnails from hosts we do not trust", async () => {
    const id = ytId();
    mockFetchJson.mockResolvedValueOnce({ status: 200, json: { title: "x", thumbnail_url: "https://evil.example/a.jpg" } });
    const result = await resolveLink(`https://youtu.be/${id}`);
    expect(result.ok && result.value.source.meta).toEqual({ title: "x" });
  });

  it("rejects videos that do not exist", async () => {
    mockFetchJson.mockResolvedValueOnce({ status: 404, json: null });
    const result = await resolveLink(`https://youtu.be/${ytId()}`);
    expect(result).toMatchObject({ ok: false });
  });

  it("falls back to an external link when embedding is disabled", async () => {
    const id = ytId();
    mockFetchJson.mockResolvedValueOnce({ status: 401, json: null });
    const result = await resolveLink(`https://youtu.be/${id}?t=5`);
    expect(result).toMatchObject({
      ok: true,
      value: { source: { provider: "link", ref: { url: `https://www.youtube.com/watch?v=${id}` } }, t: 5, needsTitle: true },
    });
  });

  it("still lets you add a video when YouTube is unreachable", async () => {
    const id = ytId();
    mockFetchJson.mockRejectedValueOnce(new Error("timeout"));
    const result = await resolveLink(`https://youtu.be/${id}`);
    expect(result).toMatchObject({ ok: true, value: { source: { provider: "youtube", meta: null }, needsTitle: true } });
  });

  it("uses the Data API for duration and the embeddable flag when a key is set", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "k");
    try {
      const id = ytId();
      mockFetchJson
        .mockResolvedValueOnce({ status: 200, json: { title: "t" } })
        .mockResolvedValueOnce({ status: 200, json: { items: [{ contentDetails: { duration: "PT1H2M3S" }, status: { embeddable: true } }] } });
      const result = await resolveLink(`https://youtu.be/${id}`);
      expect(result).toMatchObject({ ok: true, value: { source: { provider: "youtube", meta: { title: "t", duration: 3723 } } } });

      const id2 = ytId();
      mockFetchJson
        .mockResolvedValueOnce({ status: 200, json: { title: "t" } })
        .mockResolvedValueOnce({ status: 200, json: { items: [{ contentDetails: { duration: "PT5M" }, status: { embeddable: false } }] } });
      const blocked = await resolveLink(`https://youtu.be/${id2}`);
      expect(blocked).toMatchObject({ ok: true, value: { source: { provider: "link" } } });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("resolveLink: Bilibili", () => {
  const view = (data: object, code = 0) => ({ status: 200, json: { code, data } });

  it("reads title, author, part and duration for the requested part", async () => {
    const bv = bvId();
    mockFetchJson.mockResolvedValueOnce(
      view({
        title: "合集",
        pic: "http://i0.hdslb.com/bfs/archive/a.jpg",
        owner: { name: "UP" },
        duration: 900,
        pages: [
          { page: 1, part: "第一集", duration: 400 },
          { page: 2, part: "第二集", duration: 500 },
        ],
      }),
    );
    const result = await resolveLink(`https://www.bilibili.com/video/${bv}?p=2&t=90`);
    expect(result).toEqual({
      ok: true,
      value: {
        source: {
          provider: "bilibili",
          ref: { bvid: bv, p: 2 },
          meta: { title: "合集", author: "UP", thumbnail: "https://i0.hdslb.com/bfs/archive/a.jpg", duration: 500, part: "第二集" },
        },
        t: 90,
        warnings: [],
        needsTitle: false,
      },
    });
  });

  it("rejects a part that does not exist", async () => {
    mockFetchJson.mockResolvedValueOnce(view({ title: "x", pages: [{ page: 1 }] }));
    const result = await resolveLink(`https://www.bilibili.com/video/${bvId()}?p=3`);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects deleted and hidden videos", async () => {
    mockFetchJson.mockResolvedValueOnce({ status: 200, json: { code: -404 } });
    expect(await resolveLink(`https://www.bilibili.com/video/${bvId()}`)).toMatchObject({ ok: false });
    mockFetchJson.mockResolvedValueOnce({ status: 200, json: { code: 62002 } });
    expect(await resolveLink(`https://www.bilibili.com/video/${bvId()}`)).toMatchObject({ ok: false });
  });

  it("asks for a manual title when Bilibili blocks the request", async () => {
    // HTML anti-bot page => json: null; also -352 / HTTP 412
    for (const response of [{ status: 412, json: null }, { status: 200, json: { code: -352 } }, { status: 200, json: null }]) {
      mockFetchJson.mockResolvedValueOnce(response);
      const result = await resolveLink(`https://www.bilibili.com/video/${bvId()}`);
      expect(result).toMatchObject({ ok: true, value: { source: { provider: "bilibili", meta: null }, needsTitle: true } });
    }
  });

  it("does not cache an anti-bot answer as the truth", async () => {
    const bv = bvId();
    mockFetchJson.mockResolvedValueOnce({ status: 412, json: null });
    await resolveLink(`https://www.bilibili.com/video/${bv}`);
    mockFetchJson.mockResolvedValueOnce(view({ title: "now it works" }));
    const second = await resolveLink(`https://www.bilibili.com/video/${bv}`);
    expect(second).toMatchObject({ ok: true, value: { source: { meta: { title: "now it works" } } } });
  });
});

describe("resolveLink: generic and invalid", () => {
  it("keeps other pages as links titled by hostname", async () => {
    expect(await resolveLink("https://example.com/post")).toMatchObject({
      ok: true,
      value: { source: { provider: "link", ref: { url: "https://example.com/post" }, meta: { title: "example.com" } } },
    });
    expect(mockFetchJson).not.toHaveBeenCalled(); // we never fetch arbitrary user URLs
  });

  it("rejects junk", async () => {
    expect(await resolveLink("javascript:alert(1)")).toMatchObject({ ok: false });
    expect(await resolveLink("")).toMatchObject({ ok: false });
  });
});

describe("followAllowedRedirects (SSRF guard)", () => {
  const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
  const ok = () => new Response("ok", { status: 200 });
  const stubFetch = (...responses: Response[]) => {
    const fn = vi.fn();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    vi.stubGlobal("fetch", fn);
    return fn;
  };

  it("follows a b23.tv short link to the Bilibili video", async () => {
    stubFetch(redirect("https://www.bilibili.com/video/BV1GJ411x7h7?share=1"), ok());
    expect(await followAllowedRedirects("https://b23.tv/abc", REDIRECT_ALLOWED_HOSTS)).toBe(
      "https://www.bilibili.com/video/BV1GJ411x7h7?share=1",
    );
  });

  it("refuses to leave the allowlist, on any hop", async () => {
    const fn = stubFetch(redirect("https://evil.example/steal"));
    expect(await followAllowedRedirects("https://b23.tv/abc", REDIRECT_ALLOWED_HOSTS)).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1); // the evil host was never contacted

    const fn2 = stubFetch(redirect("https://www.bilibili.com/a"), redirect("http://169.254.169.254/latest/meta-data"));
    expect(await followAllowedRedirects("https://b23.tv/abc", REDIRECT_ALLOWED_HOSTS)).toBeNull();
    expect(fn2).toHaveBeenCalledTimes(2);
  });

  it("refuses plain http, credentials, ports and look-alike hosts up front", async () => {
    const fn = stubFetch();
    for (const url of [
      "http://b23.tv/abc",
      "https://user:pw@b23.tv/abc",
      "https://b23.tv:8443/abc",
      "https://b23.tv.evil.example/abc",
      "https://127.0.0.1/",
      "not a url",
    ]) {
      expect(await followAllowedRedirects(url, REDIRECT_ALLOWED_HOSTS)).toBeNull();
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it("gives up on redirect loops", async () => {
    const responses = Array.from({ length: 10 }, () => redirect("https://b23.tv/again"));
    const fn = stubFetch(...responses);
    expect(await followAllowedRedirects("https://b23.tv/abc", REDIRECT_ALLOWED_HOSTS, { maxHops: 3 })).toBeNull();
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("accepts a predicate, e.g. Open Library covers bouncing through archive.org", async () => {
    stubFetch(
      redirect("https://archive.org/download/m_covers_0010/a.zip/b.jpg"),
      redirect("https://ia600505.us.archive.org/view_archive.php?file=b.jpg"),
      ok(),
    );
    expect(await followAllowedRedirects("https://covers.openlibrary.org/b/id/1-M.jpg", isAllowedImageRedirectHost)).toBe(
      "https://ia600505.us.archive.org/view_archive.php?file=b.jpg",
    );
    const fn = stubFetch(redirect("https://archive.org.evil.example/x.jpg"));
    expect(await followAllowedRedirects("https://covers.openlibrary.org/b/id/1-M.jpg", isAllowedImageRedirectHost)).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resolveLink rejects a short link that ends elsewhere", async () => {
    stubFetch(redirect("https://evil.example/x"));
    expect(await resolveLink("https://b23.tv/abc")).toMatchObject({ ok: false });
  });

  it("resolveLink resolves a short link through to the video", async () => {
    const bv = bvId();
    stubFetch(redirect(`https://www.bilibili.com/video/${bv}`), ok());
    mockFetchJson.mockResolvedValueOnce({ status: 200, json: { code: 0, data: { title: "短链视频", pages: [{ page: 1 }] } } });
    expect(await resolveLink("https://b23.tv/abc")).toMatchObject({
      ok: true,
      value: { source: { provider: "bilibili", ref: { bvid: bv, p: 1 }, meta: { title: "短链视频" } } },
    });
  });
});

describe("helpers", () => {
  it("parses ISO-8601 durations", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("P0D")).toBeUndefined();
    expect(parseIsoDuration("nonsense")).toBeUndefined();
  });

  it("only keeps https images from Bilibili's CDN", () => {
    expect(normalizeBilibiliImage("//i0.hdslb.com/a.jpg")).toBe("https://i0.hdslb.com/a.jpg");
    expect(normalizeBilibiliImage("http://i1.hdslb.com/a.jpg")).toBe("https://i1.hdslb.com/a.jpg");
    expect(normalizeBilibiliImage("https://evil.example/a.jpg")).toBeUndefined();
    expect(normalizeBilibiliImage(42)).toBeUndefined();
  });
});

describe("checkVideoHealth", () => {
  it("maps platform answers to ok / dead / unknown", async () => {
    const { checkVideoHealth } = await import("@/lib/links/check");
    const yt = { videoId: "dQw4w9WgXcQ" };
    for (const [status, expected] of [[200, "ok"], [404, "dead"], [401, "dead"], [500, "unknown"], [429, "unknown"]] as const) {
      mockFetchJson.mockResolvedValueOnce({ status, json: null });
      expect(await checkVideoHealth("youtube", yt)).toBe(expected);
    }

    const bili = { bvid: "BV1GJ411x7h7" };
    for (const [response, expected] of [
      [{ status: 200, json: { code: 0 } }, "ok"],
      [{ status: 200, json: { code: -404 } }, "dead"],
      [{ status: 200, json: { code: 62002 } }, "dead"],
      [{ status: 200, json: { code: -352 } }, "unknown"],
      [{ status: 412, json: null }, "unknown"],
      [{ status: 200, json: null }, "unknown"],
    ] as const) {
      mockFetchJson.mockResolvedValueOnce(response);
      expect(await checkVideoHealth("bilibili", bili)).toBe(expected);
    }

    mockFetchJson.mockRejectedValueOnce(new Error("network"));
    expect(await checkVideoHealth("youtube", yt)).toBe("unknown");
    expect(await checkVideoHealth("episode", {})).toBe("unknown");
  });
});

describe("nextHealthState", () => {
  it("does not believe a single dead answer, but two in a row", async () => {
    const { nextHealthState } = await import("@/lib/links/check");
    const fresh = { status: "ok" as const, fail_count: 0 };
    const once = nextHealthState(fresh, "dead");
    expect(once).toEqual({ status: "ok", fail_count: 1 });
    expect(nextHealthState(once!, "dead")).toEqual({ status: "dead", fail_count: 2 });
  });

  it("revives a source and resets the counter on ok", async () => {
    const { nextHealthState } = await import("@/lib/links/check");
    expect(nextHealthState({ status: "dead", fail_count: 3 }, "ok")).toEqual({ status: "ok", fail_count: 0 });
    expect(nextHealthState({ status: "ok", fail_count: 1 }, "ok")).toEqual({ status: "ok", fail_count: 0 });
  });

  it("leaves everything alone when the answer is unknown", async () => {
    const { nextHealthState } = await import("@/lib/links/check");
    expect(nextHealthState({ status: "ok", fail_count: 1 }, "unknown")).toBeNull();
  });
});
