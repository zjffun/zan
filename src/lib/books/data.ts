import type { Availability, Book, BookStage } from "./types";

/** When the sources below were looked at. They are public web pages, read once, not checked line by line: the owners' own pages decide. */
export const CHECKED_ON = "2026年10月31日";

/** The reading order: where to start, and where to go on. */
export const BOOK_STAGES: BookStage[] = [
  { id: "relief", title: "先止痛" },
  { id: "thoughts", title: "学会和念头相处" },
  { id: "patterns", title: "看清模式" },
  { id: "restart", title: "重新出发" },
];

const HAPPINESS_TRAP_FREE = { label: "作者官网：免费资源", url: "https://thehappinesstrap.com/free-resources/" };

export const BOOKS: Book[] = [
  {
    id: "reality-slap",
    title: "生活的陷阱",
    original: "The Reality Slap（第 2 版在美国叫 When Life Hits Hard）",
    author: "Russ Harris（路斯·哈里斯）",
    guessed: true,
    stage: "relief",
    resources: [
      {
        name: "“额外内容”：引导式正念音频、价值观和目标设定工作表、自我关怀练习",
        kind: "exercise",
        availability: "free",
        note: "作者官网免费提供，文件里写着欢迎自由分享给可能受益的人。能不能放进本站，以官网的条款为准。",
        links: [HAPPINESS_TRAP_FREE, { label: "第 2 版的额外内容（PsychWire）", url: "https://psychwire.com/free-resources/clinical-tools/resource-1vcr6ic/the-reality-slap-2nd-edition" }],
      },
      { name: "书里的量表", kind: "scale", availability: "none", note: "没有查到这本书附有量表。" },
    ],
  },
  {
    id: "self-compassion",
    title: "自我关怀的力量",
    original: "Self-Compassion: The Proven Power of Being Kind to Yourself",
    author: "Kristin Neff（克里斯汀·内夫）",
    guessed: true,
    stage: "relief",
    resources: [
      {
        name: "自我关怀量表简版（SCS-SF）",
        kind: "scale",
        availability: "open",
        scaleId: "scs-sf",
        note: "Neff 的说明文件写明：可以用于任何目的，包括研究、临床和教学；翻译要按她的要求验证因子结构。是这批书里唯一明确允许自由使用的量表，已经做进本站，中文题目取自她网站上的中文版。",
        links: [{ label: "SCS-SF 使用说明（PDF）", url: "https://self-compassion.org/wp-content/uploads/2021/03/SCS-SF-information.pdf" }],
      },
      {
        name: "自我关怀量表（完整版 SCS，含中文译本）",
        kind: "scale",
        availability: "free",
        note: "作者的网站提供，有资料说中文译本也在上面。具体的使用条款没找到，研究以外的用法先问作者团队。",
        links: [{ label: "self-compassion.org", url: "https://self-compassion.org/" }],
      },
      {
        name: "自我关怀练习和引导冥想",
        kind: "exercise",
        availability: "free",
        note: "网站免费提供；页面上没有写复用条款。",
        links: [{ label: "自我关怀练习（self-compassion.org）", url: "https://self-compassion.org/self-compassion-practices/" }],
      },
    ],
  },
  {
    id: "msc",
    title: "静观自我关怀",
    original: "The Mindful Self-Compassion Workbook（推测）",
    author: "Kristin Neff、Christopher Germer",
    guessed: true,
    stage: "relief",
    resources: [
      {
        name: "免费的引导冥想和练习（Center for Mindful Self-Compassion）",
        kind: "exercise",
        availability: "personal",
        note: "官网写明仅供个人使用，不要未经许可复制或分发；要转载或用在课程里，先按它的“材料使用政策”申请。",
        links: [{ label: "冥想与练习（centerformsc.org）", url: "https://centerformsc.org/pages/meditations-and-practices" }],
      },
      {
        name: "随书的音频和练习",
        kind: "exercise",
        availability: "personal",
        note: "出版社网站可以下载练习，供个人使用；书里写明了音频的使用条款（我看到的资料说在第 206 页，没能核对）。",
        links: [{ label: "出版社：随书工具", url: "https://www.guilford.com/books/The-Mindful-Self-Compassion-Workbook/Neff-Germer/9781462526789/tools" }],
      },
    ],
  },
  {
    id: "happiness-trap",
    title: "幸福的陷阱（原书第2版）",
    original: "The Happiness Trap (2nd edition)",
    author: "Russ Harris（路斯·哈里斯）",
    stage: "thoughts",
    resources: [
      {
        name: "工作表和“额外内容”：选择点（Choice Point）图、应对策略表、价值观和目标设定、引导式音频",
        kind: "exercise",
        availability: "free",
        note: "作者官网免费提供，也有一份合订的工作表 PDF。官网没有写能不能转载。",
        links: [
          HAPPINESS_TRAP_FREE,
          { label: "额外内容（PsychWire）", url: "https://psychwire.com/free-resources/clinical-tools/resource-wlrbqr/the-happiness-trap-extra-bits" },
          { label: "合订的工作表（PDF）", url: "https://thehappinesstrap.com/upimages/The_Complete_Happiness_Trap_Worksheets.pdf" },
        ],
      },
      { name: "书里的量表", kind: "scale", availability: "none", note: "没有查到这本书附有量表。" },
    ],
  },
  {
    id: "reinventing-your-life",
    title: "性格的陷阱：如何修补童年形成的性格缺陷",
    original: "Reinventing Your Life",
    author: "Jeffrey E. Young、Janet S. Klosko（杰弗里·杨、珍妮特·克罗斯科）",
    stage: "patterns",
    resources: [
      {
        name: "人生陷阱问卷（开头的总问卷，以及各章的小测）",
        kind: "scale",
        availability: "none",
        note: "没有官方的公开版本。网上有一份第三方的英文转载，没有写授权，不建议使用；中文版没找到。",
        links: [
          { label: "官网上的这本书", url: "https://www.schematherapy.com/id202.htm" },
          { label: "第三方英文转载（版权未明）", url: "https://psytests.org/cbt/11loven.html" },
        ],
      },
      { name: "各陷阱的自我练习", kind: "exercise", availability: "none", note: "没有查到官方公开的练习材料。" },
    ],
  },
  {
    id: "mind-traps",
    title: "走出心理陷阱",
    guessed: true,
    stage: "patterns",
    note: "还没能确认是哪本书。搜到一本讲四种心理陷阱（反刍、回避、情绪驱动的行为、自我批评）的工作手册，Ruth Baer 的 Practicing Happiness，不确定是不是这本。请告诉我作者或出版社。",
    resources: [],
  },
  {
    id: "schema-therapy",
    title: "图式疗法",
    original: "Schema Therapy: A Practitioner's Guide",
    author: "Jeffrey E. Young、Janet S. Klosko、Marjorie E. Weishaar",
    guessed: true,
    stage: "patterns",
    resources: [
      {
        name: "杨氏图式问卷（YSQ）等图式问卷",
        kind: "scale",
        availability: "paid",
        note: "版权方 Schema Therapy Institute 的说明：复印要先向他们订购，不买就复制算侵权；翻译要有书面许可。订购在 schematherapy.org。",
        links: [
          { label: "使用与翻译许可", url: "https://schematherapy.com/id46.htm" },
          { label: "订购说明", url: "https://schematherapy.com/id55.htm" },
        ],
      },
    ],
  },
  {
    id: "confidence-gap",
    title: "自信的陷阱",
    original: "The Confidence Gap",
    author: "Russ Harris（路斯·哈里斯）",
    guessed: true,
    stage: "restart",
    resources: [
      {
        name: "全部工作表，以及引言和第一章的试读",
        kind: "exercise",
        availability: "free",
        note: "作者官网免费提供；下载页可能要先留邮箱。官网没有写能不能转载。",
        links: [
          { label: "作者官网：工作表", url: "https://thehappinesstrap.com/the-confidence-gap-worksheets/" },
          HAPPINESS_TRAP_FREE,
        ],
      },
      { name: "书里的量表", kind: "scale", availability: "none", note: "没有查到这本书附有量表。" },
    ],
  },
  {
    id: "act-with-love",
    title: "爱的陷阱",
    original: "ACT with Love",
    author: "Russ Harris（路斯·哈里斯）",
    guessed: true,
    stage: "restart",
    resources: [
      {
        name: "全部工作表，以及“额外内容”（关系价值观清单、正念音频、沟通和宽恕练习等）",
        kind: "exercise",
        availability: "free",
        note: "作者官网和 PsychWire 都能下载。工作表 PDF 标明版权属于 Russ Harris（2009）。",
        links: [
          HAPPINESS_TRAP_FREE,
          { label: "额外内容（PsychWire）", url: "https://psychwire.com/free-resources/clinical-tools/resource-1u6l9ni/act-with-love-extra-bits" },
        ],
      },
      { name: "书里的量表", kind: "scale", availability: "none", note: "没有查到这本书附有量表。" },
    ],
  },
];

/** How each kind of availability is called, and what it means: the key to the labels on the page. */
export const AVAILABILITY: Record<Availability, { label: string; meaning: string }> = {
  open: { label: "可用于本站", meaning: "作者明确允许自由使用（教学等也算），可以做成站内的互动测验" },
  free: { label: "官方免费", meaning: "官方网站免费提供，但没写能不能转载：只能链接过去，不能抄进来" },
  personal: { label: "仅限个人使用", meaning: "官方免费，但写明不得复制或分发" },
  paid: { label: "要购买或授权", meaning: "要买，或向版权方申请" },
  none: { label: "没找到公开版", meaning: "没有查到官方公开的版本" },
  unknown: { label: "还没查", meaning: "还没有查过" },
};
