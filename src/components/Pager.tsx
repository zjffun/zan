import Link from "next/link";
import { buildHref } from "@/lib/feed";

/** Previous / next links for a list. `params` are the other query parameters to keep. */
export function Pager({
  path,
  page,
  hasMore,
  params = {},
}: {
  path: string;
  page: number;
  hasMore: boolean;
  params?: Record<string, string | number | null | undefined>;
}) {
  if (page <= 1 && !hasMore) return null;
  return (
    <nav aria-label="翻页" className="mt-6 flex items-center justify-between">
      {page > 1 ? (
        <Link href={buildHref(path, { ...params, page: page - 1 })} className="btn">
          上一页
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">第 {page} 页</span>
      {hasMore ? (
        <Link href={buildHref(path, { ...params, page: page + 1 })} className="btn">
          下一页
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
