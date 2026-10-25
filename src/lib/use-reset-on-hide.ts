"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * With Cache Components a page you navigate away from is hidden, not unmounted, so its state is
 * still there when you come back (Next.js "Preserving UI state"). That is right for a draft, but
 * wrong for a form that has just been sent: it would come back stuck on "sending…" or still full
 * of what was already published.
 *
 * Call the returned function when the form has succeeded and is about to navigate away; `reset`
 * then runs the moment the page is hidden (not earlier, or the form would flash empty while the
 * next page loads). A draft that was abandoned without sending is left alone.
 */
export function useResetOnHide(reset: () => void): () => void {
  const armed = useRef(false);
  const latest = useRef(reset);

  useLayoutEffect(() => {
    latest.current = reset;
  });

  useLayoutEffect(
    () => () => {
      if (!armed.current) return;
      armed.current = false;
      latest.current();
    },
    [],
  );

  return useCallback(() => {
    armed.current = true;
  }, []);
}
