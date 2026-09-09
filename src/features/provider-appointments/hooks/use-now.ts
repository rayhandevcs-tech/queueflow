"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, refreshed about once a minute.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the clock is
 * external mutable state, and reading it during a server render would hydrate
 * to a different minute than the browser sees. `getServerSnapshot` returns
 * `null`, so the server draws no "now" marker at all and the client fills it
 * in on its first commit — no hydration mismatch, and no `setState` inside an
 * effect.
 *
 * Callers must handle `null`: it means "not mounted yet", not midnight.
 */

/**
 * The snapshot has to keep its identity while nothing has changed, or React
 * re-renders on every read. One shared clock for every board on the page.
 */
let cached: Date | null = null;

function subscribe(onStoreChange: () => void) {
  // Twice the resolution the board draws, so a minute boundary is never more
  // than half a minute stale.
  const id = setInterval(onStoreChange, 30_000);
  return () => clearInterval(id);
}

function getSnapshot(): Date {
  const now = new Date();
  const changed =
    !cached ||
    cached.getMinutes() !== now.getMinutes() ||
    cached.getHours() !== now.getHours() ||
    cached.getDate() !== now.getDate();
  if (changed) cached = now;
  return cached as Date;
}

function getServerSnapshot(): Date | null {
  return null;
}

export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
