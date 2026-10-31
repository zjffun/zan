import type { Scale, ScaleBand } from "./types";

/**
 * What every scale has to satisfy, so that a slip in a data file (a band that stops one point short, a
 * question that belongs to a sub-scale nobody defined) is caught by the tests instead of by a reader.
 * Returns the problems found, in plain words; an empty list means the scale is sound.
 */
export function validateScale(scale: Scale): string[] {
  const problems: string[] = [];
  const say = (text: string) => problems.push(`${scale.id}：${text}`);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scale.id)) say("id 只能是小写字母、数字和连字符");
  if (!Number.isInteger(scale.version) || scale.version < 1) say("version 要是正整数");
  if (!scale.title.trim() || !scale.short.trim() || !scale.summary.trim() || !scale.prompt.trim()) say("标题、简称、简介和提示语都不能空");
  if (scale.intro.length === 0) say("要有指导语");
  if (!scale.source.credit.trim() || !scale.source.terms.trim()) say("要写明出处和使用条款");

  const { options } = scale;
  if (options.length < 2) say("至少要有两个选项");
  options.forEach((option, index) => {
    if (!option.label.trim()) say(`第 ${index + 1} 个选项没有文字`);
    if (index > 0 && !(option.value > options[index - 1].value)) say("选项的分值要从小到大排");
  });

  if (scale.items.length === 0) say("没有题目");
  scale.items.forEach((item, index) => {
    if (!item.text.trim()) say(`第 ${index + 1} 题没有文字`);
    if (item.alertAt !== undefined && !options.some((option) => option.value === item.alertAt)) {
      say(`第 ${index + 1} 题的 alertAt 不是任何一个选项的分值`);
    }
  });
  if (scale.items.some((item) => item.alertAt !== undefined) && !scale.alertText) say("有题目设了 alertAt，却没有 alertText");

  const multiplier = scale.multiplier ?? 1;
  if (!(multiplier > 0)) say("multiplier 要大于 0");
  const lowest = options[0]?.value ?? 0;
  const highest = options[options.length - 1]?.value ?? 0;

  const ids = new Set<string>();
  for (const subscale of scale.subscales ?? []) {
    if (ids.has(subscale.id)) say(`分量表 ${subscale.id} 重复了`);
    ids.add(subscale.id);
    const count = scale.items.filter((item) => item.subscale === subscale.id).length;
    if (count === 0) say(`分量表 ${subscale.id} 下没有题目`);
    checkBands(`分量表 ${subscale.id}`, subscale.bands, count * lowest * multiplier, count * highest * multiplier, say);
  }
  scale.items.forEach((item, index) => {
    if (item.subscale !== undefined && !ids.has(item.subscale)) say(`第 ${index + 1} 题属于不存在的分量表 ${item.subscale}`);
  });

  if (scale.total) checkBands("总分", scale.total.bands, scale.items.length * lowest * multiplier, scale.items.length * highest * multiplier, say);
  if (!scale.total && !scale.subscales?.length) say("总分和分量表至少要有一个，否则没有结果可看");

  return problems;
}

/**
 * Bands must start at the lowest possible score, end at the highest, and follow one another with no gap
 * and no overlap: scores are whole numbers, so the next band starts one above where the last one ended.
 */
function checkBands(where: string, bands: readonly ScaleBand[], min: number, max: number, say: (text: string) => void) {
  if (bands.length === 0) return say(`${where}没有分数区间`);
  bands.forEach((band, index) => {
    if (!band.label.trim() || !band.text.trim()) say(`${where}的第 ${index + 1} 个区间缺文字`);
    if (band.min > band.max) say(`${where}的区间 ${band.label} 起点比终点大`);
    if (index > 0 && band.min !== bands[index - 1].max + 1) say(`${where}的区间 ${band.label} 和上一个区间没有首尾相接`);
  });
  if (bands[0].min !== min) say(`${where}的区间要从最低分 ${min} 开始，现在是 ${bands[0].min}`);
  const last = bands[bands.length - 1];
  if (last.max !== max) say(`${where}的区间要到最高分 ${max} 为止，现在是 ${last.max}`);
}
