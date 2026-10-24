/**
 * Hosts we are willing to talk to or follow redirects to. Everything the server
 * fetches on a user's behalf must land on one of these, otherwise a crafted
 * short link could make us request internal addresses (SSRF).
 */
export const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export const BILIBILI_HOSTS = new Set(["bilibili.com", "www.bilibili.com", "m.bilibili.com"]);

/** Short links we resolve by following redirects. */
export const BILIBILI_SHORT_HOSTS = new Set(["b23.tv"]);

/** Every hop of a b23.tv redirect chain has to be in here. */
export const REDIRECT_ALLOWED_HOSTS = new Set([...BILIBILI_HOSTS, ...BILIBILI_SHORT_HOSTS]);

/** Image hosts we accept for cover/thumbnail URLs (and are willing to fetch for OG images). */
export function isAllowedImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "lain.bgm.tv" ||
    h === "covers.openlibrary.org" ||
    h === "i.ytimg.com" ||
    h === "img.youtube.com" ||
    h === "hdslb.com" ||
    h.endsWith(".hdslb.com")
  );
}

export function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && isAllowedImageHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Hosts an image URL may be *redirected* through. Open Library covers answer with a
 * 302 to archive.org, which in turn redirects to a rotating ia*.us.archive.org server.
 */
export function isAllowedImageRedirectHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return isAllowedImageHost(h) || h === "archive.org" || h.endsWith(".archive.org");
}
