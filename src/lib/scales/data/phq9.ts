import type { Scale } from "../types";
import { FREQUENCY_OPTIONS } from "./common";

export const phq9: Scale = {
  id: "phq-9",
  version: 1,
  group: "mood",
  title: "抑郁症状自评",
  short: "PHQ-9",
  summary: "9 道题，看看过去两周里情绪低落、兴趣下降等症状有多频繁。",
  prompt: "在过去两周里，下面这个问题困扰你的频率是：",
  intro: [
    "PHQ-9（患者健康问卷抑郁量表）是医疗机构里常用的抑郁症状筛查工具，一共 9 道题，每题回想最近两周的情况，选最符合的一项。",
    "没有对错之分，凭第一感觉选就好。",
  ],
  options: FREQUENCY_OPTIONS,
  items: [
    { text: "做事时提不起劲，或没有兴趣" },
    { text: "感到心情低落、沮丧或绝望" },
    { text: "入睡困难、睡不安稳，或睡得过多" },
    { text: "感觉疲倦，或没有活力" },
    { text: "食欲不振，或吃得过多" },
    { text: "觉得自己很糟，或觉得自己很失败，或让自己或家人失望" },
    { text: "对事物很难集中注意力，例如看书或看电视的时候" },
    { text: "动作或说话慢到别人已经察觉；或者相反，烦躁不安、坐不住，比平时动来动去得多" },
    { text: "有不如死掉，或用某种方式伤害自己的念头", alertAt: 1 },
  ],
  total: {
    bands: [
      { min: 0, max: 4, label: "几乎没有", tone: "good", text: "最近两周里，抑郁方面的症状几乎没有，或者很轻微。" },
      { min: 5, max: 9, label: "轻度", tone: "notice", text: "有一些抑郁方面的症状。可以留意自己的睡眠、饮食和活动，过一段时间再测一次，看看是在变好还是变差。" },
      {
        min: 10,
        max: 14,
        label: "中度",
        tone: "notice",
        text: "症状已经比较明显（10 分是这份量表常用的筛查界线）。建议和家人朋友聊聊，也可以预约心理咨询师或医生，做一次专业的评估。",
      },
      {
        min: 15,
        max: 19,
        label: "中重度",
        tone: "care",
        text: "症状比较重，很可能已经影响到日常生活。建议尽快去精神科或心理科做一次专业的评估，不必一个人扛着。",
      },
      {
        min: 20,
        max: 27,
        label: "重度",
        tone: "care",
        text: "症状很重。请尽快联系精神科或心理科医生；在见到医生之前，也请告诉身边信任的人，让他们陪着你。",
      },
    ],
  },
  alertText:
    "你在第 9 题选了“完全没有”以外的答案。有这样的念头并不少见，但值得认真对待：请尽快告诉你信任的人，或拨打全国统一心理援助热线 12356。如果此刻就有伤害自己的危险，请立刻拨打 120 或 110，或去最近医院的急诊。",
  source: {
    credit: "Kroenke K, Spitzer RL, Williams JBW. The PHQ-9: validity of a brief depression severity measure. J Gen Intern Med, 2001.",
    terms: "原作者声明可免费复制、翻译、展示和分发，无需许可。中文题目由本站译写，不是官方译本，字句可能与其他中文版略有不同。",
    url: "https://www.phqscreeners.com",
    rights: "open",
  },
};
