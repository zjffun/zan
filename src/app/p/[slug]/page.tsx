import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeaderView } from "@/components/SiteHeader";
import { PublicView, type PublicNote } from "@/components/PublicView";
import { renderDocHtml } from "@/lib/doc/render";
import { getPublicPage, listPublicPages, SLUG_PATTERN } from "@/lib/public";
import { parseSnapshot } from "@/lib/snapshot";
import { docToPlainText } from "@/lib/doc/text";
import { sanitizeDocOrEmpty } from "@/lib/doc/schema";
import { workLinks } from "@/lib/works/external";

// The whole route must be static (no cookies, no per-request work): a slug that was not prerendered
// is generated on the first request, and the response waits for it, so that an unknown or unpublished
// page answers with a real 404 instead of a streamed "soft 404".
export const ensureStatic = "navigation";

// Pages are rendered on first visit and then served from the cache until the
// owner republishes or unpublishes. Existing public pages are prerendered at
// build time; the placeholder keeps the build valid when there are none yet.
export async function generateStaticParams() {
  let slugs: string[] = [];
  try {
    slugs = (await listPublicPages()).slice(0, 50).map((p) => p.slug);
  } catch {
    // no database at build time: everything renders on demand instead
  }
  return (slugs.length > 0 ? slugs : ["placeholder0"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = SLUG_PATTERN.test(slug) ? await getPublicPage(slug) : null;
  const snapshot = page ? parseSnapshot(page.snapshot) : null;
  if (!page || !snapshot) return { title: "未找到", robots: { index: false, follow: false } };

  const firstNote = snapshot.notes.map((n) => docToPlainText(sanitizeDocOrEmpty(n.body))).find(Boolean);
  const description = firstNote
    ? Array.from(firstNote).slice(0, 140).join("")
    : `${snapshot.work.title} 的笔记，共 ${snapshot.notes.length} 条。`;
  return {
    title: snapshot.work.title,
    description,
    alternates: { canonical: `/p/${slug}` },
    // unlisted = reachable by link only, never by search engines
    robots: page.visibility === "unlisted" ? { index: false, follow: false } : undefined,
    openGraph: { title: snapshot.work.title, description, type: "article", url: `/p/${slug}` },
    twitter: { card: "summary_large_image", title: snapshot.work.title, description },
  };
}

// No <Suspense> around this on purpose: the response has to wait for the data so that a missing or
// unpublished page answers with a real 404 status (a streamed not-found would be a "soft 404").
export default async function PublicPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const page = SLUG_PATTERN.test(slug) ? await getPublicPage(slug) : null;
  const snapshot = page ? parseSnapshot(page.snapshot) : null;
  if (!page || !snapshot) notFound();

  const notes: PublicNote[] = snapshot.notes.map((n) => ({
    id: n.id,
    source_id: n.source_id,
    anchor: n.anchor,
    html: renderDocHtml(n.body),
  }));

  return (
    <>
      <HeaderView user="static" />
      <main>
        <PublicView
          work={snapshot.work}
          links={workLinks(snapshot.work)}
          sources={snapshot.sources}
          notes={notes}
          publishedAt={page.published_at}
          version={page.version}
          slug={slug}
        />
      </main>
    </>
  );
}
