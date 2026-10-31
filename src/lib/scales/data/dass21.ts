import type { Scale, ScaleBand } from "../types";

/** The ranges are the DASS manual's, for the 21-item form (sums doubled). The texts are ours. */
const bands = (cuts: [number, number, number, number], label: string): ScaleBand[] => {
  const [mild, moderate, severe, extreme] = cuts;
  return [
    { min: 0, max: mild - 1, label: "正常", tone: "good", text: `${label}方面没有超出一般范围。` },
    { min: mild, max: moderate - 1, label: "轻度", tone: "notice", text: `${label}方面有一些症状，可以留意并多照顾自己。` },
    { min: moderate, max: severe - 1, label: "中度", tone: "notice", text: `${label}方面的症状已经比较明显，建议和信任的人聊聊，必要时找心理咨询师或医生评估。` },
    { min: severe, max: extreme - 1, label: "重度", tone: "care", text: `${label}方面的症状较重，可能已经影响到生活，建议尽快找专业人士评估。` },
    { min: extreme, max: 42, label: "极重度", tone: "care", text: `${label}方面的症状很重，请尽快联系精神科或心理科医生，也告诉身边信任的人。` },
  ];
};

export const dass21: Scale = {
  id: "dass-21",
  version: 1,
  group: "mood",
  title: "抑郁、焦虑、压力自评",
  short: "DASS-21",
  summary: "21 道题，分别看过去一周里抑郁、焦虑和压力三个方面的状态。",
  prompt: "过去一周里，下面这句话符合你的情况吗？",
  intro: [
    "DASS-21（抑郁—焦虑—压力量表）一共 21 道题，每题描述一种感受或反应，请回想过去一周，选最符合你的一项。结果会分成抑郁、焦虑、压力三个部分。",
    "没有对错之分，也不要在任何一题上想太久。",
  ],
  options: [
    { value: 0, label: "完全不符合" },
    { value: 1, label: "有时符合" },
    { value: 2, label: "经常符合" },
    { value: 3, label: "几乎总是符合" },
  ],
  multiplier: 2,
  items: [
    { text: "我觉得很难让自己平静下来", subscale: "stress" },
    { text: "我感到口干舌燥", subscale: "anxiety" },
    { text: "我好像一点都感受不到愉快、舒畅", subscale: "depression" },
    { text: "我感到呼吸困难（例如没有体力活动时也呼吸急促、喘不过气）", subscale: "anxiety" },
    { text: "我感到很难主动去做事", subscale: "depression" },
    { text: "我对事情往往反应过度", subscale: "stress" },
    { text: "我感到颤抖（例如手发抖）", subscale: "anxiety" },
    { text: "我觉得自己消耗了很多精神", subscale: "stress" },
    { text: "我担心自己会在某些场合惊慌失措、出洋相", subscale: "anxiety" },
    { text: "我觉得自己没有什么可期待的", subscale: "depression" },
    { text: "我发现自己容易烦躁不安", subscale: "stress" },
    { text: "我感到很难放松", subscale: "stress" },
    { text: "我感到闷闷不乐、情绪低落", subscale: "depression" },
    { text: "有什么事妨碍我做手头的事，我就无法忍受", subscale: "stress" },
    { text: "我感到快要惊慌失措了", subscale: "anxiety" },
    { text: "我对任何事情都无法产生热情", subscale: "depression" },
    { text: "我觉得自己作为一个人没什么价值", subscale: "depression" },
    { text: "我觉得自己有点敏感易怒", subscale: "stress" },
    { text: "没有体力活动时，我也能感觉到自己的心跳（例如心跳加快、漏跳一拍）", subscale: "anxiety" },
    { text: "我无缘无故地感到害怕", subscale: "anxiety" },
    { text: "我觉得生活没有意义", subscale: "depression" },
  ],
  subscales: [
    {
      id: "depression",
      title: "抑郁",
      description: "情绪低落、觉得自己没有价值、对事情没有兴趣，也看不到期待。",
      bands: bands([10, 14, 21, 28], "抑郁"),
    },
    {
      id: "anxiety",
      title: "焦虑",
      description: "身体上的紧张反应（口干、发抖、心跳、呼吸），以及对惊慌的担心。",
      bands: bands([8, 10, 15, 20], "焦虑"),
    },
    {
      id: "stress",
      title: "压力",
      description: "难以放松、神经紧绷、容易烦躁和易怒。",
      bands: bands([15, 19, 26, 34], "压力"),
    },
  ],
  source: {
    credit: "Lovibond SH, Lovibond PF. Manual for the Depression Anxiety Stress Scales (2nd ed.). Psychology Foundation of Australia, 1995.",
    terms: "新南威尔士大学 DASS 网站说明该量表属于公共领域，使用无需许可，但需注明出处。中文题目由本站译写，不是官方译本。",
    url: "https://www2.psy.unsw.edu.au/dass/",
    rights: "open",
  },
};
