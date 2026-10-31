/** Shown with every result: these are tools for knowing yourself, not for diagnosing. */
export const SCALE_DISCLAIMER =
  "这份量表只用于自我了解，不是诊断。分数偏高不代表一定有问题，分数偏低也不代表一定没有问题。如果这些困扰影响了你的生活，请和医生或心理咨询师聊聊。";

/** About how many minutes a questionnaire takes: a few seconds a statement. */
export const minutesFor = (itemCount: number) => Math.max(1, Math.round((itemCount * 10) / 60));
