"use client";

import { useState } from "react";

/** Copies the address of the current page. */
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="tap text-sm text-muted transition-colors hover:text-accent"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // clipboard blocked: nothing sensible to do
        }
      }}
    >
      {copied ? "已复制链接" : "分享"}
    </button>
  );
}
