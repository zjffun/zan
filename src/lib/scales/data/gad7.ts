import type { Scale } from "../types";
import { FREQUENCY_OPTIONS } from "./common";

export const gad7: Scale = {
  id: "gad-7",
  version: 1,
  group: "mood",
  title: "广泛性焦虑自评",
  short: "GAD-7",
  summary: "7 道题，看看过去两周里紧张、担忧、坐立不安有多频繁。",
  prompt: "在过去两周里，下面这个问题困扰你的频率是：",
  intro: [
    "GAD-7（广泛性焦虑量表）是医疗机构里常用的焦虑症状筛查工具，一共 7 道题，每题回想最近两周的情况，选最符合的一项。",
    "没有对错之分，凭第一感觉选就好。",
  ],
  options: FREQUENCY_OPTIONS,
  items: [
    { text: "感觉紧张、焦虑，或心里悬着" },
    { text: "无法停止或控制担忧" },
    { text: "对各种各样的事情担忧过多" },
    { text: "很难放松下来" },
    { text: "坐立不安，难以静坐" },
    { text: "变得容易烦恼或急躁" },
    { text: "感到好像会有可怕的事情发生" },
  ],
  total: {
    bands: [
      { min: 0, max: 4, label: "几乎没有", tone: "good", text: "最近两周里，焦虑方面的症状几乎没有，或者很轻微。" },
      { min: 5, max: 9, label: "轻度", tone: "notice", text: "有一些焦虑方面的症状。可以留意是什么事情在触发它，试试规律作息和放松练习，过一段时间再测一次。" },
      {
        min: 10,
        max: 14,
        label: "中度",
        tone: "notice",
        text: "症状已经比较明显（10 分是这份量表常用的筛查界线）。建议和家人朋友聊聊，也可以预约心理咨询师或医生，做一次专业的评估。",
      },
      {
        min: 15,
        max: 21,
        label: "重度",
        tone: "care",
        text: "症状比较重，很可能已经影响到日常生活。建议尽快去精神科或心理科做一次专业的评估，不必一个人扛着。",
      },
    ],
  },
  source: {
    credit: "Spitzer RL, Kroenke K, Williams JBW, Löwe B. A brief measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern Med, 2006.",
    terms: "原作者声明可免费复制、翻译、展示和分发，无需许可。中文题目由本站译写，不是官方译本，字句可能与其他中文版略有不同。",
    url: "https://www.phqscreeners.com",
    rights: "open",
  },
};
