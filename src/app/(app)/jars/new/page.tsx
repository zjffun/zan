import type { Metadata } from "next";
import { NewJar } from "@/components/NewJar";

export const metadata: Metadata = { title: "攒一部作品" };

export default function NewJarPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">攒一部作品</h1>
      <p className="mt-1 text-sm text-muted">
        从 Bangumi（动画、书、漫画、游戏、真人剧）或 Open Library（书，可按 ISBN）搜索作品；找不到就手动创建。
      </p>
      <NewJar />
    </main>
  );
}
