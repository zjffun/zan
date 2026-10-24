import type { Metadata } from "next";
import { NewTagForm } from "@/components/NewTagForm";

export const metadata: Metadata = { title: "新建标签", robots: { index: false, follow: false } };

export default function NewTagPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">新建标签</h1>
      <p className="mt-1 text-sm text-muted">
        标签是聚在一起的地方：一部作品、一类东西、一个话题。从 Bangumi（动画、书、漫画、游戏、真人剧）或 Open Library（书，可按 ISBN）搜索作品，找不到就手动创建。
      </p>
      <NewTagForm />
    </main>
  );
}
