"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "./icons";

/**
 * A button that opens a small panel of links. Closes on a click outside, on
 * Escape and when something inside is chosen. The panel's children are plain
 * server-rendered links and forms.
 */
export function Menu({
  label,
  buttonClassName = "btn btn-quiet btn-sm",
  children,
}: {
  label: ReactNode;
  buttonClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" className={buttonClassName} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}
        <ChevronDownIcon className="size-3.5 opacity-70" />
      </button>
      {open ? (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute right-0 top-full z-30 mt-1.5 min-w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Styling for the rows inside a Menu (links and buttons alike). */
export const menuItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-sunken";
