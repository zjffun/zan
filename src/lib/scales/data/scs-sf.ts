import type { Scale } from "../types";

/**
 * The 12 items are in the order of Raes et al.'s short form. The Chinese wording is that of the matching items of
 * the full scale's Chinese translation (Chen, Yan & Zhou, 2011) that Neff's site offers; the short form's number
 * in the full scale is noted on each item.
 */
export const scsSf: Scale = {
  id: "scs-sf",
  version: 1,
  group: "self",
  title: "自我关怀量表（简版）",
  short: "SCS-SF",
  summary: "12 道题，看看遇到困难和失败的时候，你通常怎样对待自己。",
  prompt: "在痛苦的时刻，你通常怎样对待自己？下面这句话符合你的频率是：",
  intro: [
    "自我关怀量表由 Kristin Neff 编制，看的是在痛苦、失败，或者觉得自己不够好的时候，你对自己是友善、理解，还是批评、孤立。简版从完整版的 26 道题里选出 12 道，总分和完整版几乎一致。",
    "请回想你遇到困难时通常的做法，选这句话出现的频率，没有对错之分。其中有几道题是反着问的，计分时本站已经自动处理。",
    "结果只看总分：作者说明，简版每个分量表只有两道题，不够可靠。分档是作者给的经验参考，没有临床常模，主要用来和自己比较，比如过一阵子再测一次。",
  ],
  options: [
    { value: 1, label: "从不如此" },
    { value: 2, label: "很少如此" },
    { value: 3, label: "有时如此" },
    { value: 4, label: "经常如此" },
    { value: 5, label: "总是如此" },
  ],
  reportMean: true,
  items: [
    // full scale item 6
    { text: "当我在一些对自己来说重要的事情上失败后，我会不断地想自己的不足。", reverse: true },
    // 26
    { text: "我尽量去理解和包容自己性格中自己不喜欢的方面。" },
    // 14
    { text: "当一些令人痛苦的事情发生时，我尽量用平和的心态来面对。" },
    // 13
    { text: "当情绪低落时，我会觉得大多数人可能比我快乐。", reverse: true },
    // 15
    { text: "我尽量把自己的失败看成人生经历的一部分。" },
    // 12
    { text: "当我经历艰难困苦时，我会关心自己、善待自己。" },
    // 9
    { text: "遇到烦心事时，我会尽量让自己的情绪保持稳定。" },
    // 25
    { text: "在一些对自己重要的事情上失败时，我容易觉得是自己一个人在承受失败，感到孤独。", reverse: true },
    // 2
    { text: "当我情绪低落时，我容易纠结于不顺心的事情。", reverse: true },
    // 10
    { text: "当我感到自己在某些方面不足时，我尽量提醒自己：大部分人和我一样，都不完美。" },
    // 1
    { text: "对自己的缺点和不足，我持不满和批判的态度。", reverse: true },
    // 11
    { text: "对于我性格中那些自己不喜欢的方面，我不能容忍。", reverse: true },
  ],
  // Neff's rubric on the average per item: 1.0–2.49 low, 2.5–3.5 moderate, 3.51–5.0 high. Twelve items: that is a sum of up to 29, 30 to 42, 43 and more.
  total: {
    bands: [
      {
        min: 12,
        max: 29,
        label: "偏低",
        tone: "notice",
        text: "平均每题低于 2.5。遇到困难和失败时，你对自己的态度更偏向批评、觉得只有自己这样，或者陷在情绪里出不来。这不是评判，也不是定论：自我关怀是可以练习的。",
      },
      {
        min: 30,
        max: 42,
        label: "中等",
        tone: "good",
        text: "平均每题在 2.5 到 3.5 之间。遇到困难时，你有时能善待自己，有时又会苛责自己。",
      },
      {
        min: 43,
        max: 60,
        label: "偏高",
        tone: "good",
        text: "平均每题高于 3.5。遇到困难时，你多数时候能善待自己，明白自己并不完美，也能平和地面对痛苦的情绪。",
      },
    ],
  },
  source: {
    credit:
      "Raes F, Pommier E, Neff KD, Van Gucht D. Construction and factorial validation of a short form of the Self-Compassion Scale. Clinical Psychology & Psychotherapy, 2011, 18, 250–255. 中文题目：Chen J, Yan L, Zhou L. Reliability and validity of Chinese version of Self-compassion Scale. Chinese Journal of Clinical Psychology, 2011, 19(6), 734–736。",
    terms:
      "Kristin Neff 的书面声明：简版可以用于任何目的，包括研究、临床和教学，引用时请注明出处。中文题目取自 Neff 网站提供的中文版里对应的 12 题；中间三档的选项文字由本站添加。中文简版没有单独做过验证（有研究验证过 10 题的中文简版），本站也没有做。",
    url: "https://self-compassion.org/wp-content/uploads/2021/03/SCS-SF-information.pdf",
    rights: "open",
  },
};
