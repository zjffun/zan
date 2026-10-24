import type { Metadata, Viewport } from "next";
import { siteUrlFallback } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrlFallback()),
  title: { default: "zan", template: "%s · zan" },
  description: "攒下每一部作品的视频时间点、书的页码和你自己的笔记。只存引用，不存内容；默认私人，一键发布。",
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
          看过的、读过的，一点一点攒下来。
        </footer>
      </body>
    </html>
  );
}
