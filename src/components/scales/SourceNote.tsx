import type { Scale } from "@/lib/scales/types";

/** Where the scale comes from and the terms it is used under. */
export function SourceNote({ scale }: { scale: Scale }) {
  const { source } = scale;
  return (
    <details className="text-sm text-muted">
      <summary className="tap cursor-pointer select-none">出处与使用条款</summary>
      <div className="mt-2 space-y-1.5 leading-6">
        <p>{source.credit}</p>
        <p>{source.terms}</p>
        {source.url ? (
          <p>
            <a className="underline underline-offset-2" href={source.url} target="_blank" rel="noopener noreferrer nofollow">
              原作者的页面
            </a>
          </p>
        ) : null}
      </div>
    </details>
  );
}
