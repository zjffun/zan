"use client";

import { chipFromElement } from "@/lib/doc/chip-dom";
import type { ChipAttrs } from "@/lib/doc/schema";

/**
 * Renders note HTML that came from `renderDocHtml` (whitelist-rendered, escaped)
 * and turns clicks on its anchor chips into `onChip` calls.
 */
export function RichHtml({ html, onChip }: { html: string; onChip?: (attrs: ChipAttrs) => void }) {
  return (
    <div
      className="note-body"
      onClick={(event) => {
        const chip = chipFromElement(event.target);
        if (chip) onChip?.(chip);
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
