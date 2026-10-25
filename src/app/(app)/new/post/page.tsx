import type { Metadata } from "next";
import { Suspense } from "react";
import { PostComposer } from "@/components/PostComposer";
import type { TagPick } from "@/components/TagPicker";
import { requireUser } from "@/lib/dal";
import { getTag } from "@/lib/tags";

export const metadata: Metadata = { title: "发布内容", robots: { index: false, follow: false } };

async function Composer({ searchParams }: Pick<PageProps<"/new/post">, "searchParams">) {
  const params = await searchParams;
  const slug = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  await requireUser(`/new/post${slug ? `?tag=${encodeURIComponent(slug)}` : ""}`);
  // coming from a tag page: that tag is already on the post
  const tag = slug ? await getTag(slug).catch(() => null) : null;
  const presetTags: TagPick[] = tag ? [{ id: tag.id, name: tag.name }] : [];
  // another tag in the address is another form: the page keeps the earlier one alive, with its tags
  return <PostComposer key={presetTags.map((t) => t.id).join(",")} presetTags={presetTags} />;
}

export default function NewPostPage(props: PageProps<"/new/post">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">发布内容</h1>
      <p className="mt-1 text-sm text-muted">写一段想法，或贴一个 B 站 / YouTube 视频，再给它挂上标签。</p>
      <div className="mt-6">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-sunken" />}>
          <Composer searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
