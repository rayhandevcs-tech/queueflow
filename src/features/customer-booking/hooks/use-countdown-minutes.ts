"use client";

import { useEffect, useState } from "react";

/** Minutes remaining until `targetIso`, ticking every 15s. Null when no target. */
export function useCountdownMinutes(targetIso: string | null): number | null {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (!targetIso) return null;
  const diffMs = new Date(targetIso).getTime() - nowMs;
  return Math.max(0, Math.ceil(diffMs / 60_000));
}
