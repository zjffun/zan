import { dass21 } from "./data/dass21";
import { gad7 } from "./data/gad7";
import { phq9 } from "./data/phq9";
import { rses } from "./data/rses";
import { scsSf } from "./data/scs-sf";
import type { Scale, ScaleGroup } from "./types";

/** The groups the list is cut into, in the order they are shown. A group with no scale is not shown. */
export const SCALE_GROUPS: ScaleGroup[] = [
  { id: "mood", title: "情绪与压力", description: "最近一段时间的情绪、焦虑和压力状态。" },
  { id: "self", title: "自我评价", description: "你对自己整体上是怎么看的。" },
  { id: "life-traps", title: "人生陷阱问卷", description: "杰弗里·杨、珍妮特·克罗斯科《性格的陷阱》里的问卷。" },
];

/** Every scale on the site, in the order they are listed. To add one, write its file in `data/` and add it here. */
export const SCALES: Scale[] = [phq9, gad7, dass21, rses, scsSf];

export function getScale(id: string): Scale | undefined {
  return SCALES.find((scale) => scale.id === id);
}

/** Whether search engines and the site map may know about the scale: only one that is free to use. */
export const isIndexable = (scale: Scale) => scale.source.rights === "open";
