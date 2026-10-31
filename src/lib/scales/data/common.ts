import type { ScaleOption } from "../types";

/** "How often in the last two weeks": the answers of the PHQ-9 and the GAD-7. */
export const FREQUENCY_OPTIONS: ScaleOption[] = [
  { value: 0, label: "完全没有" },
  { value: 1, label: "好几天" },
  { value: 2, label: "一半以上的天数" },
  { value: 3, label: "几乎每天" },
];
