/**
 * One date-range model for every analytics query.
 *
 * The rule, and it is the same rule on both sides of the wire: a range is two
 * **calendar days**, `from` and `to`, and **both ends are inclusive**. The SQL
 * side (`analytics_scope`) turns that pair into the half-open instant range
 * `[from 00:00 Dhaka, to+1 00:00 Dhaka)`, so "today to today" is one whole
 * local day and a job finished at 23:50 counts on the day the shopkeeper
 * thinks it happened. Nothing in the client re-derives that boundary — it
 * sends two dates and lets one function in one place decide what they mean.
 *
 * Timezone: the project's documented convention is Asia/Dhaka (hard-coded in
 * the SQL). Here the dates are built from the **device's own local calendar**,
 * which is the same convention the rest of the app already uses (`ymd()`,
 * `day-key.ts`, the appointment board). That is deliberately not a timezone
 * refactor: a shopkeeper's phone is in Dhaka, and inventing a second
 * timezone model for one screen would put the analytics a day out of step
 * with the board and the income page.
 */

import { ymd } from "@/lib/day-key";

export type RangePreset = "TODAY" | "LAST_7" | "LAST_30" | "THIS_MONTH" | "CUSTOM";

export interface DateRange {
  /** Inclusive first day, "YYYY-MM-DD". */
  from: string;
  /** Inclusive last day, "YYYY-MM-DD". */
  to: string;
}

/**
 * The widest span the server will accept, in days **between** the two ends —
 * mirroring `analytics_scope`'s `(p_to - p_from) > 1095` exactly. An inclusive
 * range of 1096 days is therefore the largest legal one.
 */
export const MAX_RANGE_SPAN_DAYS = 1095;

export const RANGE_PRESETS: readonly RangePreset[] = [
  "TODAY",
  "LAST_7",
  "LAST_30",
  "THIS_MONTH",
  "CUSTOM",
] as const;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "2026-09-15" → a local midnight Date, or null.
 *
 * Built field by field rather than with `new Date(string)`, which parses a
 * bare date as **UTC** and so lands on the previous day everywhere east of
 * Greenwich — the exact bug `ymd()` exists to avoid.
 */
export function parseYmd(value: string | null | undefined): Date | null {
  if (!value || !YMD.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects "2026-02-31", which the constructor would roll over to 3 March.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/** `n` days from `date`, as a new local-midnight Date. */
export function addDays(date: Date, n: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + n);
  return next;
}

/**
 * Whole days from `from` to `to` — the span, not the count.
 *
 * Measured on local midnights, so a DST-style offset change (which Dhaka does
 * not have, but the device clock might) cannot make a day count 23 hours and
 * round the answer down.
 */
export function daySpan(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** How many calendar days the range covers, both ends counted. */
export function rangeDays(range: DateRange): number | null {
  const from = parseYmd(range.from);
  const to = parseYmd(range.to);
  if (!from || !to) return null;
  return daySpan(from, to) + 1;
}

export type RangeProblem = "MALFORMED" | "REVERSED" | "TOO_WIDE";

/**
 * Why the server would refuse this range — or null if it would not.
 *
 * Deliberately a mirror of `analytics_scope`'s three `raise exception`s rather
 * than a looser client-side opinion: a range this returns null for is one the
 * database accepts, so the owner never sees a red error where a polite form
 * message belongs, and never the other way round.
 */
export function rangeProblem(range: DateRange): RangeProblem | null {
  const from = parseYmd(range.from);
  const to = parseYmd(range.to);
  if (!from || !to) return "MALFORMED";
  const span = daySpan(from, to);
  if (span < 0) return "REVERSED";
  if (span > MAX_RANGE_SPAN_DAYS) return "TOO_WIDE";
  return null;
}

export function isValidRange(range: DateRange): boolean {
  return rangeProblem(range) === null;
}

/**
 * The preset ranges, all of them ending **today**.
 *
 * "Last 7 days" means today and the six before it — seven days including
 * today, not eight. A shopkeeper opening the page at noon expects this
 * morning's work to be in the "last 7 days" number, so the window has to
 * include the day in progress even though it is not over.
 */
export function presetRange(preset: RangePreset, today: Date = new Date()): DateRange {
  const to = ymd(today);
  switch (preset) {
    case "TODAY":
      return { from: to, to };
    case "LAST_7":
      return { from: ymd(addDays(today, -6)), to };
    case "LAST_30":
      return { from: ymd(addDays(today, -29)), to };
    case "THIS_MONTH":
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
        to,
      };
    case "CUSTOM":
      // A custom range has no canonical value; the last 30 days is what the
      // picker opens on so the owner edits a real range rather than a blank.
      return presetRange("LAST_30", today);
  }
}

/**
 * Which preset a range **is**, so a reload or a shared URL lights the right
 * chip instead of always falling to "custom".
 */
export function presetFor(range: DateRange, today: Date = new Date()): RangePreset {
  for (const preset of ["TODAY", "LAST_7", "LAST_30", "THIS_MONTH"] as const) {
    const candidate = presetRange(preset, today);
    if (candidate.from === range.from && candidate.to === range.to) return preset;
  }
  return "CUSTOM";
}

/**
 * Daily bars or monthly ones.
 *
 * Ninety days is roughly where a daily bar chart stops being readable on a
 * phone, so a wider window switches to months. The server offers both and has
 * no opinion about which to ask for — this is a presentation decision, and it
 * lives on the client where presentation decisions belong.
 */
export function trendBucket(range: DateRange): "DAY" | "MONTH" {
  const days = rangeDays(range);
  return days !== null && days > 90 ? "MONTH" : "DAY";
}

/** True when the range reaches into the future — used to caption, not to block. */
export function includesFuture(range: DateRange, today: Date = new Date()): boolean {
  const to = parseYmd(range.to);
  if (!to) return false;
  return daySpan(today, to) > 0;
}

/**
 * A stable key for a range, for query keys and `useEffect` deps.
 *
 * Two dates, joined — not the object, which would be a new reference on every
 * render and would make TanStack Query refetch forever.
 */
export function rangeKey(range: DateRange): string {
  return `${range.from}..${range.to}`;
}
