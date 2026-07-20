"use client";

import { useEffect, useState } from "react";

/** Minutes elapsed since `startedAt` (ISO string). Re-renders once a minute
 *  visually, ticks internally each second so the first minute flips on time. */
export function useElapsed(startedAt: string | null): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return 0;
  const elapsed = Math.floor((nowMs - new Date(startedAt).getTime()) / 60_000);
  return Math.max(0, elapsed);
}