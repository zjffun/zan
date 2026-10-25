import type { SelectHTMLAttributes } from "react";
import { ChevronDownIcon } from "./icons";

/**
 * A dropdown with the site's input look. The browser's own arrow sits right against the edge of the
 * box; this one is drawn here, with room around it (the native arrow is switched off in globals.css).
 * `className` goes on the wrapper, so margins and widths place the whole control.
 */
export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative block ${className}`}>
      <select {...props} className="input">
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </span>
  );
}
