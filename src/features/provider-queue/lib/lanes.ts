import type { Chair, Serial } from "@/types";

export interface Lane {
  chair: Chair;
  /** The job on the chair right now (DB guarantees at most one). */
  inProgress: Serial | null;
  /** Waiting serials in DB position order — never re-numbered client-side. */
  waiting: Serial[];
  /** Committed minutes: remaining in-progress time + all waiting estimates. */
  backlogMin: number;
  /** [Start] is offered only when the chair is free. */
  canStart: boolean;
  /** Chair was deactivated while still holding live serials — render dimmed. */
  chairInactive: boolean;
}

/** Remaining minutes of a running job, clamped to ≥1 (overruns never go negative). */
export function remainingMin(serial: Serial, nowMs: number): number {
  const startedMs = serial.started_at
    ? new Date(serial.started_at).getTime()
    : nowMs;
  const endMs = startedMs + serial.estimated_duration_min * 60_000;
  return Math.max(1, Math.ceil((endMs - nowMs) / 60_000));
}

/**
 * rows → lanes.
 * Visible lanes = active chairs (sort_order) ∪ inactive chairs that still
 * hold live serials (a mid-shift deactivation must not hide real customers).
 */
export function buildLanes(
  serials: readonly Serial[] | undefined,
  chairs: readonly Chair[] | undefined,
  nowMs: number = Date.now(),
): Lane[] {
  if (!chairs?.length) return [];

  const byChair = new Map<string, Serial[]>();
  for (const s of serials ?? []) {
    const list = byChair.get(s.chair_id);
    if (list) list.push(s);
    else byChair.set(s.chair_id, [s]);
  }

  const lanes: Lane[] = [];

  for (const chair of [...chairs].sort((a, b) => a.sort_order - b.sort_order)) {
    const rows = (byChair.get(chair.id) ?? []).sort(
      (a, b) => a.position - b.position,
    );

    if (!chair.is_active && rows.length === 0) continue;

    const inProgress = rows.find((r) => r.status === "IN_PROGRESS") ?? null;
    const waiting = rows.filter((r) => r.status === "WAITING");

    const backlogMin =
      (inProgress ? remainingMin(inProgress, nowMs) : 0) +
      waiting.reduce((sum, r) => sum + r.estimated_duration_min, 0);

    lanes.push({
      chair,
      inProgress,
      waiting,
      backlogMin,
      canStart: inProgress === null && waiting.length > 0 && chair.is_active,
      chairInactive: !chair.is_active,
    });
  }

  return lanes;
}

/** Header totals: waiting / in-progress across the whole board. */
export function boardTotals(lanes: readonly Lane[]): {
  waiting: number;
  inProgress: number;
} {
  let waiting = 0;
  let inProgress = 0;
  for (const lane of lanes) {
    waiting += lane.waiting.length;
    if (lane.inProgress) inProgress += 1;
  }
  return { waiting, inProgress };
}