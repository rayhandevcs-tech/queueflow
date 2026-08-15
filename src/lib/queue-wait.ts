import type { QueuePublicRow } from "@/types";

/**
 * The two fields a countdown needs. Deliberately structural: a provider
 * `Serial` satisfies it, and so does a `QueuePublicRow` once its
 * `estimated_start_at` is passed as the start (for an IN_PROGRESS row the DB
 * writes the real `started_at` into `estimated_start_at`, so the customer's
 * ring and the owner's ring are counting the same seconds).
 */
export interface RunningJob {
  started_at: string | null;
  estimated_duration_min: number;
}

/**
 * Seconds left on a running job.
 *
 * `started_at` null means the clock has not been written yet (the row is one
 * render ahead of the update): treat it as starting now, so the ring opens at
 * the full service time instead of flashing 00:00. An overrun sits at 0 rather
 * than going negative — the job is late, not finished.
 */
export function remainingSec(job: RunningJob, nowMs: number): number {
  const startedMs = job.started_at ? new Date(job.started_at).getTime() : nowMs;
  const endMs = startedMs + job.estimated_duration_min * 60_000;
  return Math.max(0, (endMs - nowMs) / 1000);
}

/** Ring fill: 1 the moment the job starts, 0 once its time is up. */
export function countdownProgress(job: RunningJob, nowMs: number): number {
  const totalSec = job.estimated_duration_min * 60;
  return totalSec > 0 ? remainingSec(job, nowMs) / totalSec : 0;
}

/** Same clock, rounded up to whole minutes and clamped to >= 1, for backlogs. */
export function remainingMin(job: RunningJob, nowMs: number): number {
  return Math.max(1, Math.ceil(remainingSec(job, nowMs) / 60));
}

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
