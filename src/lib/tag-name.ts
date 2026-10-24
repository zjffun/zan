export const MAX_TAG_NAME_LENGTH = 30;

const codePoints = (text: string) => Array.from(text);

/**
 * The one way a typed-in tag name becomes a stored one: surrounding spaces and
 * leading # signs go (people type "#动漫"), inner whitespace collapses to one
 * space. Returns null when nothing usable is left or the name breaks the rules
 * the database enforces too (1–30 characters, no control characters, no "#").
 */
export function normalizeTagName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .replace(/^[\s#＃]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name === "" || codePoints(name).length > MAX_TAG_NAME_LENGTH) return null;
  if (/[\u0000-\u001f\u007f-\u009f#＃]/.test(name)) return null;
  return name;
}

/** Tags are unique ignoring case, like the database index on lower(name). */
export const tagKey = (name: string) => name.toLowerCase();
