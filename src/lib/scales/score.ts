import type { Scale, ScaleBand, ScaleResult, ScoreLine } from "./types";

/** Answers as the page holds them: one value per item, null for an item not answered yet. */
export type Answers = readonly (number | null)[];

/**
 * One value per item. Anything that is not one of the scale's answers (a missing entry, a number from an
 * old version of the scale, whatever came out of storage) counts as not answered.
 */
export function cleanAnswers(scale: Scale, raw: unknown): (number | null)[] {
  const list: unknown[] = Array.isArray(raw) ? raw : [];
  return scale.items.map((_, index) => {
    const value = list[index];
    return typeof value === "number" && scale.options.some((option) => option.value === value) ? value : null;
  });
}

/** The band a score falls in (both ends included), or null when it is in none. */
export function bandFor(bands: readonly ScaleBand[], score: number): ScaleBand | null {
  return bands.find((band) => score >= band.min && score <= band.max) ?? null;
}

/** What an answer adds up as: a backwards item counts the option at the other end of the list. */
function points(scale: Scale, reverse: boolean | undefined, value: number): number {
  const index = scale.options.findIndex((option) => option.value === value);
  return scale.options[reverse ? scale.options.length - 1 - index : index].value;
}

export function scoreScale(scale: Scale, rawAnswers: unknown): ScaleResult {
  const answers = cleanAnswers(scale, rawAnswers);
  const multiplier = scale.multiplier ?? 1;
  const lowest = scale.options[0].value;
  const highest = scale.options[scale.options.length - 1].value;

  const earned = answers.map((value, index) => (value === null ? null : points(scale, scale.items[index].reverse, value)));

  /** The sum over some items, or null while one of them is unanswered. */
  const line = (id: string, title: string, indexes: number[], bands: readonly ScaleBand[]): ScoreLine | null => {
    let sum = 0;
    for (const index of indexes) {
      const value = earned[index];
      if (value === null) return null;
      sum += value;
    }
    const score = sum * multiplier;
    return {
      id,
      title,
      score,
      min: indexes.length * lowest * multiplier,
      max: indexes.length * highest * multiplier,
      band: bandFor(bands, score),
      items: indexes.length,
      mean: sum / indexes.length,
    };
  };

  const all = scale.items.map((_, index) => index);
  const missing = all.filter((index) => answers[index] === null).map((index) => index + 1);
  const alerts = all
    .filter((index) => {
      const at = scale.items[index].alertAt;
      const value = answers[index];
      return at !== undefined && value !== null && value >= at;
    })
    .map((index) => index + 1);

  return {
    complete: missing.length === 0,
    answered: scale.items.length - missing.length,
    count: scale.items.length,
    missing,
    total: scale.total ? line("total", "总分", all, scale.total.bands) : null,
    subscales: (scale.subscales ?? []).flatMap((subscale) => {
      const indexes = all.filter((index) => scale.items[index].subscale === subscale.id);
      const scored = line(subscale.id, subscale.title, indexes, subscale.bands);
      return scored ? [scored] : [];
    }),
    alerts,
  };
}

/** The score as the page writes it: "12 / 27". */
export const scoreOutOf = (line: ScoreLine) => `${line.score} / ${line.max}`;

/** The result as plain text, to paste into a note: one line per score, with the name of its band. */
export function resultToText(scale: Scale, result: ScaleResult, date: string): string {
  const lines = [result.total, ...result.subscales].flatMap((line) =>
    line
      ? [`${line.title}：${scoreOutOf(line)}${line.band ? `（${line.band.label}）` : ""}${scale.reportMean ? ` · 平均每题 ${line.mean.toFixed(2)}` : ""}`]
      : [],
  );
  return [`${scale.title}（${scale.short}）· ${date}`, ...lines].join("\n");
}

/** The result in a few words, for the list of scales: "总分 12（中度）", or one part after another when there is no total. */
export function briefResult(result: ScaleResult): string {
  if (result.total) return `总分 ${result.total.score}${result.total.band ? `（${result.total.band.label}）` : ""}`;
  return result.subscales.map((line) => `${line.title}${line.band ? ` ${line.band.label}` : ` ${line.score}`}`).join(" · ");
}
