import "server-only";

export const USER_AGENT =
  process.env.ZAN_USER_AGENT || "zan/0.1 (+https://github.com/zjffun/zan)";

/** Bilibili's web API checks the UA and Referer; it rejects obvious bots. */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface JsonResponse {
  status: number;
  /** null when the body was empty or not JSON (e.g. an anti-bot HTML page) */
  json: unknown;
}

/** Reads at most `maxBytes` of the body, then stops. */
async function readLimited(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("response too large");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * fetch + bounded JSON parse with a timeout. Never throws on a non-2xx status
 * or a non-JSON body (callers decide what that means); throws on network
 * errors and timeouts.
 */
export async function fetchJson(
  url: string,
  init: RequestInit = {},
  { timeoutMs = 8000, maxBytes = 2_000_000 }: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<JsonResponse> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const text = await readLimited(res, maxBytes);
  try {
    return { status: res.status, json: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, json: null };
  }
}

/**
 * Follows redirects by hand, checking every hop against `allowedHosts`.
 * Returns the final URL, or null if any hop leaves the allowlist, uses a
 * non-https scheme, carries credentials, or the chain is too long. This is the
 * SSRF guard for short links such as b23.tv.
 */
export async function followAllowedRedirects(
  start: string,
  allowedHosts: ReadonlySet<string>,
  { maxHops = 4, timeoutMs = 6000 }: { maxHops?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  let current = start;
  for (let hop = 0; hop <= maxHops; hop++) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!allowedHosts.has(url.hostname.toLowerCase())) return null;

    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    await res.body?.cancel();

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      try {
        current = new URL(location, url).toString();
      } catch {
        return null;
      }
      continue;
    }
    return url.toString();
  }
  return null;
}
