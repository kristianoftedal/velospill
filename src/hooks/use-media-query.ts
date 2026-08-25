"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tracks a CSS media query.
 *
 * Uses useSyncExternalStore because matchMedia is exactly that — an external
 * store — which keeps the value tear-free and needs no state-setting effect.
 * The server snapshot is `false`, so components that branch on this must treat
 * `false` as the narrow case; that is also the safer thing to paint first.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `md` breakpoint — the point where a side panel has room. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
