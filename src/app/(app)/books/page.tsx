import type { Metadata } from "next";
import Link from "next/link";
import { TONE_COLOR } from "@/components/scales/tone";
import { AVAILABILITY, BOOKS, BOOK_STAGES, CHECKED_ON } from "@/lib/books/data";
import { BOOK_STATUS_LABEL, bookStatus, isPublic } from "@/lib/books/summary";
import type { Availability, Book, BookResource } from "@/lib/books/types";
import { getScale } from "@/lib/scales";

export const metadata: Metadata = {
  title: "书与练习",
  description: "按书整理里面的量表和练习，标出哪些有公开的内容、用什么条款。",
  // a first pass with details still to be checked: not for search engines yet
  robots: { index: false, follow: false },
};

/** Colors of the label on a resource: how freely it can be had. */
const CHIP: Record<Availability, { background: string; color: string }> = {
  open: { background: TONE_COLOR.good.soft, color: TONE_COLOR.good.solid },
  free: { background: TONE_COLOR.good.soft, color: TONE_COLOR.good.solid },
  personal: { background: TONE_COLOR.notice.soft, color: TONE_COLOR.notice.solid },
  paid: { background: TONE_COLOR.care.soft, color: TONE_COLOR.care.solid },
  none: { background: "var(--sunken)", color: "var(--muted)" },
  unknown: { background: "var(--sunken)", color: "var(--muted)" },
};

const STATUS_CHIP: Record<ReturnType<typeof bookStatus>, Availability> = { public: "free", paid: "paid", none: "none", unknown: "unknown" };

function Chip({ availability, children }: { availability: Availability; children: React.ReactNode }) {
  return (
    <span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium" style={CHIP[availability]}>
      {children}
    </span>
  );
}

function Resource({ resource }: { resource: BookResource }) {
  const onSite = resource.scaleId ? getScale(resource.scaleId) : undefined;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5">
        <span className="chip">{resource.kind === "scale" ? "量表" : "练习"}</span>
        <p className="min-w-0 flex-1 basis-48 font-medium leading-6">{resource.name}</p>
        <Chip availability={resource.availability}>{AVAILABILITY[resource.availability].label}</Chip>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted">{resource.note}</p>
      {onSite || resource.links?.length ? (
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {onSite ? (
            <Link className="font-medium text-accent underline underline-offset-2" href={`/scales/${onSite.id}`}>
              在本站作答
            </Link>
          ) : null}
          {resource.links?.map((link) => (
            <a key={link.url} className="underline underline-offset-2" href={link.url} target="_blank" rel="noopener noreferrer nofollow">
              {link.label} ↗
            </a>
          ))}
        </p>
      ) : null}
    </li>
  );
}

function BookCard({ book }: { book: Book }) {
  const status = bookStatus(book);
  const publicCount = book.resources.filter((resource) => isPublic(resource.availability)).length;
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <h3 className="min-w-0 flex-1 basis-56 text-lg font-semibold leading-snug">《{book.title}》</h3>
        <Chip availability={STATUS_CHIP[status]}>{BOOK_STATUS_LABEL[status]}</Chip>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted">
        {[book.author, book.original].filter(Boolean).join(" · ")}
        {book.guessed ? <span className="ml-1.5 inline-block whitespace-nowrap rounded bg-sunken px-1.5 py-0.5 text-xs">书名对应的原书是推测</span> : null}
      </p>
      {book.note ? <p className="mt-2 rounded-lg bg-sunken p-3 text-sm leading-6">{book.note}</p> : null}
      {book.resources.length > 0 ? (
        <>
          <p className="mt-3 text-xs text-muted">
            共 {book.resources.length} 项，其中 {publicCount} 项能免费拿到
          </p>
          <ul className="mt-1 divide-y divide-line">
            {book.resources.map((resource) => (
              <Resource key={resource.name} resource={resource} />
            ))}
          </ul>
        </>
      ) : null}
    </li>
  );
}

export default function BooksPage() {
  const withPublic = BOOKS.filter((book) => bookStatus(book) === "public").length;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/scales" className="tap -ml-1 text-sm text-muted transition-colors hover:text-accent">
        ‹ 量表
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">书与练习</h1>
      <p className="mt-2 leading-7 text-muted">
        按阅读的顺序，列出每本书里的量表和练习，标出哪些有公开的内容、用什么条款。这里只整理出处和状态，不抄任何一本书的原文。
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        {BOOKS.length} 本书里，{withPublic} 本有能免费拿到的内容。信息来自网上的公开页面（{CHECKED_ON}看的），没有逐条核实，以版权方自己的页面为准。
      </p>

      <section aria-labelledby="legend" className="mt-5 rounded-xl bg-sunken p-4">
        <h2 id="legend" className="text-sm font-semibold">
          标签的意思
        </h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {(Object.keys(AVAILABILITY) as Availability[]).map((key) => (
            <div key={key} className="flex items-start gap-2">
              <dt className="mt-0.5">
                <Chip availability={key}>{AVAILABILITY[key].label}</Chip>
              </dt>
              <dd className="leading-6 text-muted">{AVAILABILITY[key].meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      {BOOK_STAGES.map((stage) => (
        <section key={stage.id} className="mt-9" aria-labelledby={`stage-${stage.id}`}>
          <h2 id={`stage-${stage.id}`} className="text-xl font-bold tracking-tight">
            {stage.title}
          </h2>
          <ul className="mt-3 space-y-3">
            {BOOKS.filter((book) => book.stage === stage.id).map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
