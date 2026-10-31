import type { ScaleBand, ScoreLine } from "@/lib/scales/types";
import { ScoreGauge } from "./ScoreGauge";
import { TONE_COLOR } from "./tone";

/** One score with what it means: the number, its band, a bar to place it on, and the band's explanation. */
export function ScoreCard({
  line,
  bands,
  description,
  meanOutOf,
}: {
  line: ScoreLine;
  bands: ScaleBand[];
  description?: string;
  /** the highest answer, when the score is also told as an average per item */
  meanOutOf?: number;
}) {
  return (
    <section className="card p-5" aria-label={line.title}>
      <h3 className="font-semibold">{line.title}</h3>
      {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-bold tabular-nums leading-none">{line.score}</span>
        <span className="text-muted">/ {line.max} 分</span>
        {line.band ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-sm font-medium"
            style={{ background: TONE_COLOR[line.band.tone].soft, color: TONE_COLOR[line.band.tone].solid }}
          >
            {line.band.label}
          </span>
        ) : null}
      </p>
      {meanOutOf !== undefined ? (
        <p className="mt-2 text-sm text-muted">
          平均每题 <span className="font-medium text-ink">{line.mean.toFixed(2)}</span> 分（每题最高 {meanOutOf} 分）
        </p>
      ) : null}
      <ScoreGauge line={line} bands={bands} />
      {line.band ? <p className="mt-4 leading-7">{line.band.text}</p> : null}
    </section>
  );
}
