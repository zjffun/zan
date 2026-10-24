import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy. The important line is frame-src: the only things
 * that may be embedded are the two official players. Everything else is
 * same-origin; all Supabase traffic goes through our server, so connect-src
 * stays 'self'. (img-src lists archive.org because Open Library covers redirect there.)
 *
 * script-src needs 'unsafe-inline' for Next's inline bootstrap scripts (nonces
 * would make every page dynamic and defeat the cached public pages) and
 * www.youtube.com for the IFrame Player API.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ""}https://www.youtube.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lain.bgm.tv https://covers.openlibrary.org https://i.ytimg.com https://img.youtube.com https://*.hdslb.com https://archive.org https://*.archive.org",
  "frame-src https://www.youtube-nocookie.com https://player.bilibili.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // YouTube embeds refuse to play without a referrer
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
