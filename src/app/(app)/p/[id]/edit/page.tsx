import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PostComposer } from "@/components/PostComposer";
import { isUuid, requireUser } from "@/lib/dal";
import { getPost } from "@/lib/posts";

export const metadata: Metadata = { title: "编辑内容", robots: { index: false, follow: false } };

async function Editor({ params }: Pick<PageProps<"/p/[id]/edit">, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser(`/p/${id}/edit`);
  const post = await getPost(id);
  if (!post) notFound();
  if (post.author.id !== user.id) redirect(`/p/${id}`);
  return <PostComposer post={post} />;
}

export default function EditPostPage(props: PageProps<"/p/[id]/edit">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">编辑内容</h1>
      <div className="mt-6">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-sunken" />}>
          <Editor params={props.params} />
        </Suspense>
      </div>
    </main>
  );
}
