/** Longest timestamp we accept: 48 hours. Anything above is a typo or an attack. */
export const MAX_SECONDS = 48 * 3600;

/** 754 -> "12:34", 3723 -> "1:02:03". */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "12:34" / "1:02:03" -> seconds, or null when it is not a clock string. */
export function parseClock(text: string): number | null {
  const match = /^(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)$/.exec(text.trim());
  if (!match) return null;
  const hours = match[1] === undefined ? undefined : Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (hours !== undefined && minutes > 59) return null;
  const total = (hours ?? 0) * 3600 + minutes * 60 + seconds;
  return total <= MAX_SECONDS ? total : null;
}

/**
 * Parses the `t=` / `start=` parameter of a video URL: "754", "754.5", "754s",
 * "12m34s", "1h2m3s". Returns whole seconds, or null.
 */
export function parseTimeParam(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s?)?$/i.exec(text.trim());
  if (!match || (match[1] === undefined && match[2] === undefined && match[3] === undefined)) {
    return null;
  }
  const total =
    Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Math.floor(Number(match[3] ?? 0));
  return Number.isFinite(total) && total <= MAX_SECONDS ? total : null;
}

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

const dateOnly = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" });

/** "2026年10月25日": the same on the server and in the browser, whatever their clocks and zones. */
export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

/**
 * How long ago, the way a feed says it: "刚刚", "5 分钟前", "3 小时前", "2 天前"; after a week the date
 * itself. A time in the future (a clock that is a little off) is "刚刚".
 */
export function formatRelative(iso: string, now: number): string {
  const age = Math.max(0, now - new Date(iso).getTime());
  if (age < minute) return "刚刚";
  if (age < hour) return `${Math.floor(age / minute)} 分钟前`;
  if (age < day) return `${Math.floor(age / hour)} 小时前`;
  if (age < 7 * day) return `${Math.floor(age / day)} 天前`;
  return formatDate(iso);
}
