import type { Metadata, Viewport } from "next";
import { DESCRIPTION, TAGLINE } from "@/lib/brand";
import { siteUrlFallback } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrlFallback()),
  title: { default: `zan — ${TAGLINE}`, template: "%s · zan" },
  description: DESCRIPTION,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#151412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
          <p>zan（攒）· 看过的、读过的，一点一点攒下来。</p>
          <p className="mt-1">只存引用，不存内容：视频用官方播放器，书只记页码和你自己摘的短句。</p>
        </footer>
      </body>
    </html>
  );
}
