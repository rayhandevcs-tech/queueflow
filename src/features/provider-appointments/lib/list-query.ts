import { ymd } from "@/lib/day-key";
import type { AppointmentStatus } from "./types";
import { OCCUPYING_STATUSES } from "./types";

/**
 * Turning the owner's chosen filters into one database query.
 *
 * Pure and separate from the API call so the four questions an owner actually
 * asks — "what's on today", "what's coming", "what did I finish", "what fell
 * through" — are decided in one testable place rather than inside a query
 * builder. The API function does nothing but apply what this returns.
 *
 * Deliberately only these scopes plus a date range and a person. A status
 * dropdown on top of the scopes would be a second way of saying the same
 * thing, and the brief was explicit about not piling on filtering nobody
 * asked for.
 */
export type ListScope = "today" | "upcoming" | "completed" | "cancelled" | "all";

export const LIST_SCOPES: readonly ListScope[] = [
  "today",
  "upcoming",
  "completed",
  "cancelled",
  "all",
];

export interface ListFilters {
  scope: ListScope;
  /** `chairs.id`, or null for everyone. */
  staffId: string | null;
  /** Local "YYYY-MM-DD", inclusive. Overrides the scope's own window. */
  from: string | null;
  /** Local "YYYY-MM-DD", inclusive — the whole day, not midnight. */
  to: string | null;
}

export const EMPTY_FILTERS: ListFilters = {
  scope: "today",
  staffId: null,
  from: null,
  to: null,
};

export interface ListQuery {
  /** null → every status. */
  statuses: readonly AppointmentStatus[] | null;
  /** Inclusive ISO lower bound on `starts_at`, or null. */
  startFrom: string | null;
  /** Exclusive ISO upper bound on `starts_at`, or null. */
  startBefore: string | null;
  staffId: string | null;
  /** Soonest first for what is ahead, newest first for what is behind. */
  ascending: boolean;
}

/** Local midnight of the day `date` falls in. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * A local "YYYY-MM-DD" → local midnight. Built field by field rather than
 * `new Date("2026-09-10")`, which the spec reads as UTC — in Dhaka that is
 * 6am on the day, so an owner filtering "from today" would lose the morning.
 */
function parseDayStart(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function buildListQuery(filters: ListFilters, now: Date): ListQuery {
  const from = filters.from ? parseDayStart(filters.from) : null;
  // Inclusive to the owner, exclusive to the database: "to 10 September"
  // means everything before midnight on the 11th, not before midnight on
  // the 10th — which would silently drop the day they just named.
  const toRaw = filters.to ? parseDayStart(filters.to) : null;
  const before = toRaw ? addDays(toRaw, 1) : null;

  const today = startOfDay(now);
  const scoped: Omit<ListQuery, "staffId"> = (() => {
    switch (filters.scope) {
      case "today":
        return {
          statuses: null,
          startFrom: today.toISOString(),
          startBefore: addDays(today, 1).toISOString(),
          ascending: true,
        };
      // "Coming up" is about the clock, not the calendar: an appointment
      // later this afternoon belongs here. Cancelled and no-show rows are
      // excluded — they are not coming.
      case "upcoming":
        return {
          statuses: OCCUPYING_STATUSES,
          startFrom: now.toISOString(),
          startBefore: null,
          ascending: true,
        };
      case "completed":
        return { statuses: ["DONE"], startFrom: null, startBefore: null, ascending: false };
      // One tab, both ways a booking fails to happen. An owner asking "what
      // fell through" does not think of "cancelled" and "didn't turn up" as
      // separate lists, and the row itself says which it was.
      case "cancelled":
        return {
          statuses: ["CANCELLED", "NO_SHOW"],
          startFrom: null,
          startBefore: null,
          ascending: false,
        };
      case "all":
        return { statuses: null, startFrom: null, startBefore: null, ascending: false };
    }
  })();

  return {
    statuses: scoped.statuses,
    // An explicit range is the owner overriding the scope's window, so it
    // replaces the bound rather than narrowing it — otherwise "completed,
    // last month" would return nothing on the `upcoming` bound.
    startFrom: from ? from.toISOString() : scoped.startFrom,
    startBefore: before ? before.toISOString() : scoped.startBefore,
    staffId: filters.staffId,
    ascending: scoped.ascending,
  };
}

/** True when the filters differ from the default view — drives the "clear" button. */
export function hasActiveFilters(filters: ListFilters): boolean {
  return (
    filters.scope !== EMPTY_FILTERS.scope ||
    filters.staffId !== null ||
    filters.from !== null ||
    filters.to !== null
  );
}

export { ymd };
