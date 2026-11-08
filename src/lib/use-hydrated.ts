"use client";

import { useSyncExternalStore } from "react";

const never = () => () => undefined;

/** False while the page is made on the server and until it is running in the browser; true from then on. */
export function useHydrated(): boolean {
  return useSyncExternalStore(never, () => true, () => false);
}
