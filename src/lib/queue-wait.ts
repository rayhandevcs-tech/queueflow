import type { QueuePublicRow } from "@/types";

/**
 * Soonest each group (by default, each chair) frees up, in epoch ms —
 * shared by the explore list's per-shop wait estimate and the shop-detail
 * screen's single-shop wait estimate so both use identical math.
 */
export function chairFreeAtMs(
  rows: QueuePublicRow[],
  groupKey: (row: QueuePublicRow) => string = (r) => r.chair_id,
): Map<string, number> {
  const free = new Map<string, number>();
  for (const row of rows) {
    if (!row.estimated_start_at) continue;
    const freeAtMs =
      new Date(row.estimated_start_at).getTime() + row.estimated_duration_min * 60_000;
    const key = groupKey(row);
    const existing = free.get(key);
    if (existing === undefined || freeAtMs > existing) free.set(key, freeAtMs);
  }
  return free;
}

/** Minutes until the soonest of a set of free-at times, clamped to >= 0. Null if empty. */
export function minutesUntil(freeAtMsList: Iterable<number>, nowMs: number): number | null {
  let min: number | null = null;
  for (const freeAtMs of freeAtMsList) {
    const minutes = Math.max(0, Math.round((freeAtMs - nowMs) / 60_000));
    if (min === null || minutes < min) min = minutes;
  }
  return min;
}
