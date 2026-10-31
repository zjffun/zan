import type { ScaleBand, ScoreLine } from "@/lib/scales/types";
import { TONE_COLOR } from "./tone";

const range = (band: ScaleBand) => (band.min === band.max ? `${band.min}` : `${band.min}–${band.max}`);

/**
 * A bar cut into the scale's bands, with the reader's band in full color and a dot on the score; under it
 * the same bands in words, so that nothing is told by color alone.
 */
export function ScoreGauge({ line, bands }: { line: ScoreLine; bands: ScaleBand[] }) {
  const scores = line.max - line.min + 1;
  const dot = ((line.score - line.min + 0.5) / scores) * 100;
  return (
    <div className="mt-4">
      <div className="relative">
        <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden="true">
          {bands.map((band) => (
            <div
              key={band.min}
              className="border-r-2 border-surface last:border-r-0"
              style={{
                flexGrow: band.max - band.min + 1,
                flexBasis: 0,
                background: band === line.band ? TONE_COLOR[band.tone].solid : TONE_COLOR[band.tone].soft,
              }}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink shadow"
          style={{ left: `${dot}%` }}
        />
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="分数区间">
        {bands.map((band) => (
          <li key={band.min} className={band === line.band ? "font-semibold text-ink" : undefined}>
            <span
              aria-hidden="true"
              className="mr-1.5 inline-block size-2 rounded-full align-baseline"
              style={{ background: TONE_COLOR[band.tone].solid, opacity: band === line.band ? 1 : 0.55 }}
            />
            {range(band)} 分 {band.label}
            {band === line.band ? "（你在这里）" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
