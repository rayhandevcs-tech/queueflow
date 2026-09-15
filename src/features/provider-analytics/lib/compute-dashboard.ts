/**
 * The arithmetic the analytics dashboard does on top of the RPCs.
 *
 * Almost nothing, on purpose. Every total, rate and average the owner sees is
 * computed **in Postgres** by one of the Sprint 10 RPCs, over the shop's own
 * rows, inside the date range the server itself resolved. What is left for the
 * client is presentation arithmetic: ordering slots, picking the peak, working
 * out a share of a total, and — the part that actually matters — keeping a
 * real zero and an unanswerable question apart.
 *
 * **0 is not N/A.** A shop that took no appointments this week has a no-show
 * rate of "N/A", not "0%" — there were no appointments to not show up for. A
 * shop that took forty and had none miss their slot has 0%. Those are
 * different facts and a dashboard that prints the same thing for both is
 * lying. So every rate here is `number | null`, null means "cannot be
 * calculated", and the UI renders it as N/A rather than as a number.
 *
 * Nothing in this file reaches for a database, a clock or a language. It is
 * all pure, which is what makes the unit tests worth having.
 */

// ---------------------------------------------------------------------------
// the shapes the RPCs return
// ---------------------------------------------------------------------------
// Declared here rather than imported from the generated types so the pure
// functions (and their tests) stay independent of Supabase's codegen. The API
// module asserts that these still match what the client hands back, so a
// column renamed in SQL is a compile error rather than a silent `undefined`.

export interface TrendPoint {
  bucket_start: string;
  revenue_total: number;
  revenue_collected: number;
  jobs: number;
}

export interface PeakSlot {
  bucket_kind: string;
  source: string;
  bucket: number;
  jobs: number;
}

export interface StaffStatRow {
  staff_id: string;
  staff_label: string;
  staff_name: string | null;
  is_active: boolean;
  serial_jobs: number;
  appointment_jobs: number;
  jobs_total: number;
  revenue_total: number;
  cancelled: number;
  no_show: number;
  booked_minutes: number;
  /** null when this seat has no configured working hours — see decision 69. */
  working_minutes: number | null;
  utilization_pct: number | null;
}

export interface BreakdownRow {
  key: string;
  label: string;
  jobs: number;
  amount: number;
}

// ---------------------------------------------------------------------------
// rates — every one of them nullable
// ---------------------------------------------------------------------------

/** A metric that may genuinely have no value. `null` renders as N/A. */
export type Metric = number | null;

/** True when a metric cannot be calculated, as opposed to being zero. */
export function isNA(value: Metric | undefined): boolean {
  return value === null || value === undefined || !Number.isFinite(value);
}

/**
 * `part / whole` as a percentage to one decimal place, or null.
 *
 * Null for a zero, negative, missing or non-finite denominator — "out of
 * nothing" has no answer, and the alternatives (0, NaN, Infinity) all read as
 * facts on a dashboard. The one decimal place matches the SQL, which rounds
 * every rate the same way, so the page and the database never disagree in the
 * last digit.
 */
export function rate(part: number | null | undefined, whole: number | null | undefined): Metric {
  if (part === null || part === undefined || !Number.isFinite(part)) return null;
  if (whole === null || whole === undefined || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * A rate out of the bookings that actually **settled**.
 *
 * Completion, no-show and cancellation are shares of "everything that reached
 * an end", not of everything booked: a slot still sitting at CONFIRMED has not
 * failed and has not succeeded, and counting it in the denominator would drag
 * every rate down as soon as tomorrow's diary filled up. Defined this way the
 * three rates add to 100, which the harness asserts.
 */
export function settledRate(
  part: number | null | undefined,
  completed: number,
  cancelled: number,
  noShow: number,
): Metric {
  return rate(part, completed + cancelled + noShow);
}

/** Share of one amount in a total, one decimal place. */
export function shareOf(amount: number | null | undefined, total: number | null | undefined): Metric {
  return rate(amount, total);
}

/**
 * Booked minutes over configured working minutes.
 *
 * Returns null when the denominator is unknown — a seat whose working hours
 * were never set. That is the whole point: the shop's own roster is the only
 * honest denominator, and inventing one ("assume ten hours a day") would
 * produce a utilization figure that looks authoritative and means nothing.
 * Never clamped either, so a seat booked past its roster reads over 100% and
 * the owner can see the roster is wrong.
 */
export function utilization(
  bookedMinutes: number | null | undefined,
  workingMinutes: number | null | undefined,
): Metric {
  if (workingMinutes === null || workingMinutes === undefined) return null;
  return rate(bookedMinutes, workingMinutes);
}

/** An average that is null rather than 0 when there is nothing to average. */
export function average(total: number | null | undefined, count: number | null | undefined): Metric {
  if (total === null || total === undefined || !Number.isFinite(total)) return null;
  if (count === null || count === undefined || !Number.isFinite(count) || count <= 0) return null;
  return Math.round((total / count) * 100) / 100;
}

// ---------------------------------------------------------------------------
// trend
// ---------------------------------------------------------------------------

export interface TrendSummary {
  revenueTotal: number;
  revenueCollected: number;
  jobs: number;
  /** The single best bucket, or null for a window with no money in it. */
  best: TrendPoint | null;
  /** Highest bucket revenue, for scaling the bars. Never 0, so no ÷0. */
  scale: number;
  /** Average revenue per bucket **in the window**, empty days included. */
  perBucket: Metric;
}

/**
 * Totals across the trend buckets.
 *
 * These must equal `shop_overview_stats`'s own totals — the harness asserts
 * that in SQL — so this function exists to *show* the same figures a second
 * way, not to become a second source of them. The empty buckets are kept in
 * the average deliberately: "৳900 a day across the week" is the useful number,
 * and dropping the quiet days would inflate it.
 */
export function summarizeTrend(points: readonly TrendPoint[]): TrendSummary {
  let revenueTotal = 0;
  let revenueCollected = 0;
  let jobs = 0;
  let best: TrendPoint | null = null;

  for (const point of points) {
    revenueTotal += point.revenue_total;
    revenueCollected += point.revenue_collected;
    jobs += point.jobs;
    if (point.revenue_total > 0 && (!best || point.revenue_total > best.revenue_total)) {
      best = point;
    }
  }

  return {
    revenueTotal,
    revenueCollected,
    jobs,
    best,
    scale: Math.max(1, ...points.map((p) => p.revenue_total)),
    perBucket: average(revenueTotal, points.length),
  };
}

// ---------------------------------------------------------------------------
// peak slots
// ---------------------------------------------------------------------------

/** Monday-first, the way Postgres's `isodow` numbers the week. */
export const ISODOW_MIN = 1;
export const ISODOW_MAX = 7;

/**
 * Saturday first, then Sunday, then Monday–Friday.
 *
 * The Bangladeshi working week, and the same order the existing weekly chart
 * on this page already uses — two charts on one screen disagreeing about where
 * the week starts would be worse than either order being "wrong".
 */
export const WEEK_ORDER_ISODOW: readonly number[] = [6, 7, 1, 2, 3, 4, 5] as const;

export interface SlotBar {
  bucket: number;
  jobs: number;
  isPeak: boolean;
}

function pick(
  slots: readonly PeakSlot[],
  kind: "HOUR" | "WEEKDAY",
  source: "SERIAL" | "APPOINTMENT",
): Map<number, number> {
  const found = new Map<number, number>();
  for (const slot of slots) {
    if (slot.bucket_kind !== kind || slot.source !== source) continue;
    found.set(slot.bucket, (found.get(slot.bucket) ?? 0) + slot.jobs);
  }
  return found;
}

/**
 * The 24 hours, or the 7 weekdays, as a dense series with the peak marked.
 *
 * Dense because the RPC only returns the buckets that saw work: a chart drawn
 * straight from those rows would put 10am next to 4pm and hide the quiet
 * middle of the day, which is exactly the shape an owner is looking for.
 *
 * A tie leaves the **earliest** bucket marked, so the badge does not hop
 * between two equal hours from render to render.
 */
export function slotBars(
  slots: readonly PeakSlot[],
  kind: "HOUR" | "WEEKDAY",
  source: "SERIAL" | "APPOINTMENT",
): SlotBar[] {
  const found = pick(slots, kind, source);
  const buckets =
    kind === "HOUR"
      ? Array.from({ length: 24 }, (_, hour) => hour)
      : [...WEEK_ORDER_ISODOW];

  let peak: number | null = null;
  let peakJobs = 0;
  for (const bucket of buckets) {
    const jobs = found.get(bucket) ?? 0;
    if (jobs > peakJobs) {
      peakJobs = jobs;
      peak = bucket;
    }
  }

  return buckets.map((bucket) => ({
    bucket,
    jobs: found.get(bucket) ?? 0,
    isPeak: bucket === peak,
  }));
}

/** The busiest bucket, or null when nothing happened. Descriptive only. */
export function peakSlot(
  slots: readonly PeakSlot[],
  kind: "HOUR" | "WEEKDAY",
  source: "SERIAL" | "APPOINTMENT",
): SlotBar | null {
  return slotBars(slots, kind, source).find((bar) => bar.isPeak) ?? null;
}

/** Jobs counted across one kind/source pair — for "is there anything here". */
export function slotTotal(
  slots: readonly PeakSlot[],
  kind: "HOUR" | "WEEKDAY",
  source: "SERIAL" | "APPOINTMENT",
): number {
  let total = 0;
  for (const slot of slots) {
    if (slot.bucket_kind === kind && slot.source === source) total += slot.jobs;
  }
  return total;
}

/**
 * Hours worth drawing: the working part of the day, widened to whatever the
 * shop actually did.
 *
 * A 24-bar chart on a 320px screen is 13 pixels a bar. Most shops work ten
 * hours, so the window opens at 8am–10pm and then stretches — never shrinks —
 * to cover any hour that saw real work, because hiding a busy hour to make a
 * chart fit is the one thing responsive design must not do.
 */
export function hourWindow(bars: readonly SlotBar[]): { from: number; to: number } {
  let from = 8;
  let to = 22;
  for (const bar of bars) {
    if (bar.jobs <= 0) continue;
    if (bar.bucket < from) from = bar.bucket;
    if (bar.bucket > to) to = bar.bucket;
  }
  return { from, to };
}

// ---------------------------------------------------------------------------
// staff
// ---------------------------------------------------------------------------

export interface StaffSummary {
  seats: number;
  /** Seats with a real roster behind them — the utilization denominator. */
  seatsWithHours: number;
  jobs: number;
  revenue: number;
  /** Busiest seat by jobs, or null. */
  busiest: StaffStatRow | null;
  /** Utilization across the seats that have hours, or null if none do. */
  utilizationPct: Metric;
}

/**
 * Sorted by revenue, then by jobs — the order an owner reads a staff table in.
 *
 * Copies before sorting: the array belongs to the query cache, and sorting it
 * in place would mutate cached data (and trip the React Compiler's purity
 * lint, which is how that class of bug gets caught here).
 */
export function sortStaff(rows: readonly StaffStatRow[]): StaffStatRow[] {
  return [...rows].sort(
    (a, b) => b.revenue_total - a.revenue_total || b.jobs_total - a.jobs_total,
  );
}

/**
 * The shop-wide staff picture.
 *
 * Utilization is pooled — all booked minutes over all *known* working
 * minutes — rather than averaged across seats. Averaging percentages would
 * let a seat rostered for one hour count as much as one rostered for sixty.
 * Seats without hours contribute neither a numerator nor a denominator, so
 * they cannot quietly drag the figure down.
 */
export function summarizeStaff(rows: readonly StaffStatRow[]): StaffSummary {
  let jobs = 0;
  let revenue = 0;
  let booked = 0;
  let working = 0;
  let seatsWithHours = 0;
  let busiest: StaffStatRow | null = null;

  for (const row of rows) {
    jobs += row.jobs_total;
    revenue += row.revenue_total;
    if (row.working_minutes !== null) {
      seatsWithHours += 1;
      working += row.working_minutes;
      booked += row.booked_minutes;
    }
    if (row.jobs_total > 0 && (!busiest || row.jobs_total > busiest.jobs_total)) {
      busiest = row;
    }
  }

  return {
    seats: rows.length,
    seatsWithHours,
    jobs,
    revenue,
    busiest,
    utilizationPct: seatsWithHours > 0 ? rate(booked, working) : null,
  };
}

// ---------------------------------------------------------------------------
// breakdowns
// ---------------------------------------------------------------------------

/**
 * The top rows of a breakdown, each with its share of the listed total.
 *
 * The share is of what is **shown**, and `rest` says what was left out, so a
 * "top 5" list cannot read as if it were everything. The RPC already orders by
 * amount and caps at 20; this narrows it for a phone screen.
 */
export function topBreakdown(
  rows: readonly BreakdownRow[],
  limit = 6,
): {
  rows: Array<BreakdownRow & { share: Metric }>;
  total: number;
  rest: { count: number; amount: number };
  scale: number;
} {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount || b.jobs - a.jobs);
  const shown = sorted.slice(0, limit);
  const hidden = sorted.slice(limit);
  const total = sorted.reduce((sum, row) => sum + row.amount, 0);

  return {
    rows: shown.map((row) => ({ ...row, share: shareOf(row.amount, total) })),
    total,
    rest: {
      count: hidden.length,
      amount: hidden.reduce((sum, row) => sum + row.amount, 0),
    },
    scale: Math.max(1, ...shown.map((row) => row.amount)),
  };
}

// ---------------------------------------------------------------------------
// retention — descriptive only
// ---------------------------------------------------------------------------

export interface RetentionLike {
  customers_unique: number;
  customers_new: number;
  customers_returning: number;
  customers_repeat: number;
}

/**
 * New versus returning, and how many came back inside the window.
 *
 * Descriptive arithmetic over figures the database already established, and
 * nothing more: no churn score, no lifetime value, no prediction. Those need
 * either history this app has not accumulated yet or a model, and Sprint 10 is
 * explicitly descriptive analytics.
 *
 * "Returning" is a fact about the past — this customer had finished work here
 * **before** the window. "Repeat" is a fact about the window — they came more
 * than once inside it. A customer can be both, so the two never add up and are
 * never shown as if they did.
 */
export function summarizeRetention(overview: RetentionLike | null | undefined): {
  unique: number;
  newCount: number;
  returningCount: number;
  repeatCount: number;
  newRate: Metric;
  returningRate: Metric;
  repeatRate: Metric;
} | null {
  if (!overview) return null;
  const unique = overview.customers_unique;
  return {
    unique,
    newCount: overview.customers_new,
    returningCount: overview.customers_returning,
    repeatCount: overview.customers_repeat,
    newRate: rate(overview.customers_new, unique),
    returningRate: rate(overview.customers_returning, unique),
    repeatRate: rate(overview.customers_repeat, unique),
  };
}

/**
 * Loyalty or membership participation among the customers actually served.
 *
 * Null when the window served nobody — a participation rate out of zero
 * customers is not 0%, it is unanswerable. Not clamped to 100 either: a
 * programme can hold more accounts than the window served customers (people
 * who joined earlier and did not come back this week), and clamping that to a
 * tidy 100% would hide a real and interesting fact.
 */
export function participationRate(
  members: number | null | undefined,
  customersServed: number | null | undefined,
): Metric {
  return rate(members, customersServed);
}
