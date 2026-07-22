"use client";

import { useEffect, useState } from "react";

/** Wall-clock time in ms, ticking every `intervalMs` — for live countdowns. */
export function useNowMs(intervalMs: number): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return nowMs;
}
