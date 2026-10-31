import type { Tone } from "@/lib/scales/types";

/** The colors of a band: `solid` for text and the marked part of a bar, `soft` for the background behind it. */
export const TONE_COLOR: Record<Tone, { solid: string; soft: string }> = {
  good: { solid: "var(--accent)", soft: "var(--accent-soft)" },
  notice: { solid: "var(--warn-ink)", soft: "var(--warn-soft)" },
  care: { solid: "var(--danger)", soft: "color-mix(in srgb, var(--danger) 16%, var(--surface))" },
};
