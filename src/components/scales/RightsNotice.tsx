import { RIGHTS_NOTICE, isUnconfirmed } from "@/lib/scales/rights";
import type { Scale } from "@/lib/scales/types";

/** On every page of a scale whose rights nobody has cleared: says so plainly, and where it comes from. Nothing for a scale that is free to use. */
export function RightsNotice({ scale }: { scale: Scale }) {
  if (!isUnconfirmed(scale)) return null;
  return (
    <aside role="note" className="mt-4 rounded-xl border border-warn-ink bg-warn-soft p-4 text-sm leading-6 text-warn-ink">
      <p className="font-semibold">版权提示：未获授权</p>
      <p className="mt-1">{RIGHTS_NOTICE}</p>
      <p className="mt-1 opacity-80">出处：{scale.source.credit}</p>
    </aside>
  );
}
