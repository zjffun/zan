import Link from "next/link";
import type { FeedItem } from "@/lib/public";
import { WORK_KIND_LABEL } from "@/lib/types";
import { Cover } from "./Cover";

const dateFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" });

/** One published page in the home feed. */
export function FeedCard({ item }: { item: FeedItem }) {
  return (
    <Link href={`/p/${item.slug}`} className="card flex h-full gap-4 p-4 transition-colors hover:bg-sunken">
      <Cover src={item.cover_url} kind={item.kind} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold">{item.title}</h2>
        {item.title_original ? <p className="truncate text-sm text-muted">{item.title_original}</p> : null}
        {item.excerpt ? <p className="mt-2 line-clamp-3 text-sm">{item.excerpt}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="chip">{WORK_KIND_LABEL[item.kind]}</span>
          <span className="text-xs text-muted">
            {item.note_count} 条笔记 · {item.source_count} 个资源 ·{" "}
            <time dateTime={item.published_at}>{dateFormat.format(new Date(item.published_at))}</time>
          </span>
        </div>
      </div>
    </Link>
  );
}
