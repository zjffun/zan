/**
 * A scale is data: the questions, the answers on offer, which questions count backwards, how they group
 * into sub-scales, and what a score means. Nothing in the pages or in the scoring knows about one
 * particular scale, so adding one is adding a file under `data/` (see `validate.ts` for the rules the
 * tests hold every scale to).
 */

/** How a band reads: `good` is calm, `notice` is worth a look, `care` is worth talking to someone about. */
export type Tone = "good" | "notice" | "care";

/** A range of scores (both ends included) and what it means. */
export interface ScaleBand {
  min: number;
  max: number;
  /** short name of the range: "轻度", "正常范围" */
  label: string;
  /** what the range means, a sentence or two */
  text: string;
  tone: Tone;
}

/** One answer on offer. Values rise from the first option to the last. */
export interface ScaleOption {
  value: number;
  label: string;
}

export interface ScaleItem {
  text: string;
  /** scored backwards: the option at the other end of the list counts */
  reverse?: boolean;
  /** the `id` of the sub-scale this item adds to (it always adds to the total as well) */
  subscale?: string;
  /** an answer of at least this value is pointed out to the reader (the scale's `alertText` is shown) */
  alertAt?: number;
}

export interface ScaleSubscale {
  id: string;
  title: string;
  description: string;
  bands: ScaleBand[];
}

export interface ScaleSource {
  /** who made the scale, and where it was published */
  credit: string;
  /** the terms it may be used under, and what is ours (the Chinese wording) */
  terms: string;
  url?: string;
  /**
   * `open`: free to use, or used with the owner's permission.
   * `unconfirmed`: nobody has cleared the rights to publish it here. Every page of the scale says so in a
   * notice, and the scale is kept out of search engines and the site map.
   */
  rights: "open" | "unconfirmed";
}

export interface Scale {
  /** the address: /scales/<id> */
  id: string;
  /** bump it when questions or answers change, so that answers saved for the old wording are dropped */
  version: number;
  /** the `id` of one of SCALE_GROUPS */
  group: string;
  title: string;
  /** the abbreviation people know it by */
  short: string;
  /** one sentence for the list */
  summary: string;
  /** the lead-in shown above every statement: "过去两周内，下列问题困扰你的频率是：" */
  prompt: string;
  /** the instructions, one paragraph each */
  intro: string[];
  options: ScaleOption[];
  items: ScaleItem[];
  /** every sum is multiplied by this (the DASS-21 doubles its sums to match the 42-item form) */
  multiplier?: number;
  /** the authors report the score as an average per item: the result says that too (the bands stay on the sum) */
  reportMean?: boolean;
  /** a total over all items; leave it out for a scale whose total means nothing */
  total?: { bands: ScaleBand[] };
  subscales?: ScaleSubscale[];
  /** shown when an item with `alertAt` was answered that high */
  alertText?: string;
  source: ScaleSource;
}

export interface ScaleGroup {
  id: string;
  title: string;
  description: string;
}

/** The sum for the total or for one sub-scale. */
export interface ScoreLine {
  /** "total" or the sub-scale's id */
  id: string;
  title: string;
  /** after the multiplier */
  score: number;
  /** the lowest and highest score possible, after the multiplier */
  min: number;
  max: number;
  band: ScaleBand | null;
  /** how many items it sums */
  items: number;
  /** the average per item, before the multiplier */
  mean: number;
}

export interface ScaleResult {
  /** every item has a valid answer */
  complete: boolean;
  answered: number;
  count: number;
  /** numbers of the items without a valid answer, counted from 1 */
  missing: number[];
  /** null when any item is missing, or the scale has no total */
  total: ScoreLine | null;
  /** only the sub-scales whose items are all answered */
  subscales: ScoreLine[];
  /** numbers of the items answered at or above their `alertAt`, counted from 1 */
  alerts: number[];
}
