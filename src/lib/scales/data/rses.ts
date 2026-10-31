import type { Scale } from "../types";

export const rses: Scale = {
  id: "rosenberg-self-esteem",
  version: 1,
  group: "self",
  title: "自尊量表",
  short: "RSES",
  summary: "10 道题，看看你对自己整体上是怎么评价的。",
  prompt: "下面这句话符合你的情况吗？",
  intro: [
    "Rosenberg 自尊量表（RSES）是研究里使用最广的自尊测量工具，一共 10 道题，看的是你对自己整体上的价值感：是肯定、接纳自己，还是常常否定自己。",
    "请按你平时对自己的感觉作答，没有对错之分，凭第一感觉选就好。其中有几道题是反着问的，计分时本站已经自动处理。",
  ],
  options: [
    { value: 0, label: "非常不同意" },
    { value: 1, label: "不同意" },
    { value: 2, label: "同意" },
    { value: 3, label: "非常同意" },
  ],
  items: [
    { text: "总的来说，我对自己感到满意。" },
    { text: "有时我觉得自己一点都不好。", reverse: true },
    { text: "我觉得自己有不少优点。" },
    { text: "我能把事情做得和大多数人一样好。" },
    { text: "我觉得自己没有多少值得骄傲的地方。", reverse: true },
    { text: "我有时的确觉得自己没用。", reverse: true },
    { text: "我觉得自己是个有价值的人，至少和别人不相上下。" },
    { text: "我希望自己能多一些自尊。", reverse: true },
    { text: "总的来说，我倾向于觉得自己是个失败者。", reverse: true },
    { text: "我对自己持肯定的态度。" },
  ],
  total: {
    bands: [
      {
        min: 0,
        max: 14,
        label: "偏低",
        tone: "notice",
        text: "你对自己的评价偏低，可能常常否定自己、看不到自己的价值。这不是定论，自尊会随经历和练习改变；如果这种感觉困扰着你，不妨和信任的人或心理咨询师聊聊。",
      },
      {
        min: 15,
        max: 25,
        label: "正常范围",
        tone: "good",
        text: "你对自己的评价在常见的范围内（15–25 分）：大体上接纳自己，也能看到自己的不足。",
      },
      {
        min: 26,
        max: 30,
        label: "偏高",
        tone: "good",
        text: "你对自己的评价很积极，整体上肯定自己、认可自己的价值。",
      },
    ],
  },
  source: {
    credit: "Rosenberg M. Society and the Adolescent Self-Image. Princeton University Press, 1965.",
    terms: "马里兰大学社会学系说明该量表已进入公共领域，可免费使用、翻译和改编，需按学术惯例注明出处。中文题目由本站译写，不是官方译本。",
    url: "https://socy.umd.edu/about-us/rosenberg-self-esteem-scale",
    rights: "open",
  },
};
