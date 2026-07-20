import type { QueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type WithId = { id: string };

export function upsertById<T extends WithId>(
  rows: readonly T[] | undefined,
  incoming: T,
  sort?: (a: T, b: T) => number,
): T[] {
  const next = rows ? rows.filter((r) => r.id !== incoming.id) : [];
  next.push(incoming);
  return sort ? next.sort(sort) : next;
}

export function removeById<T extends WithId>(
  rows: readonly T[] | undefined,
  id: string,
): T[] {
  return rows ? rows.filter((r) => r.id !== id) : [];
}

/**
 * Apply one realtime event to a cached list — the single write path
 * for every live list in the app.
 */
export function applyListChange<T extends WithId>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  payload: RealtimePostgresChangesPayload<T>,
  sort?: (a: T, b: T) => number,
): void {
  queryClient.setQueryData<T[]>(queryKey as unknown[], (rows) => {
    switch (payload.eventType) {
      case "INSERT":
      case "UPDATE":
        return upsertById(rows, payload.new as T, sort);
      case "DELETE": {
        const id = (payload.old as Partial<T>).id;
        return id ? removeById(rows, id) : (rows ? [...rows] : []);
      }
      default:
        return rows ? [...rows] : [];
    }
  });
}

/** Canonical ordering for queue rows: lane by lane, position within lane. */
export function byChairAndPosition<
  T extends { chair_id: string; position: number },
>(a: T, b: T): number {
  return a.chair_id === b.chair_id
    ? a.position - b.position
    : a.chair_id.localeCompare(b.chair_id);
}