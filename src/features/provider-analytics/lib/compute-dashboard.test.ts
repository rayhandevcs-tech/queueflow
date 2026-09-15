import { describe, expect, it } from "vitest";
import {
  WEEK_ORDER_ISODOW,
  average,
  hourWindow,
  isNA,
  participationRate,
  peakSlot,
  rate,
  settledRate,
  shareOf,
  slotBars,
  slotTotal,
  sortStaff,
  summarizeRetention,
  summarizeStaff,
  summarizeTrend,
  topBreakdown,
  utilization,
  type BreakdownRow,
  type PeakSlot,
  type StaffStatRow,
  type TrendPoint,
} from "./compute-dashboard";

function staff(overrides: Partial<StaffStatRow> = {}): StaffStatRow {
  return {
    staff_id: "seat-1",
    staff_label: "চেয়ার ১",
    staff_name: "করিম",
    is_active: true,
    serial_jobs: 4,
    appointment_jobs: 0,
    jobs_total: 4,
    revenue_total: 3100,
    cancelled: 1,
    no_show: 1,
    booked_minutes: 180,
    working_minutes: 4200,
    utilization_pct: 4.3,
    ...overrides,
  };
}

function point(overrides: Partial<TrendPoint> = {}): TrendPoint {
  return {
    bucket_start: "2026-09-15",
    revenue_total: 0,
    revenue_collected: 0,
    jobs: 0,
    ...overrides,
  };
}

function slot(
  kind: "HOUR" | "WEEKDAY",
  source: "SERIAL" | "APPOINTMENT",
  bucket: number,
  jobs: number,
): PeakSlot {
  return { bucket_kind: kind, source, bucket, jobs };
}

// ---------------------------------------------------------------------------
// the rule the whole dashboard rests on
// ---------------------------------------------------------------------------

describe("0 is a fact, N/A is the absence of one", () => {
  it("a rate out of a real denominator is a number, zero included", () => {
    expect(rate(0, 40)).toBe(0);
    expect(isNA(rate(0, 40))).toBe(false);
  });

  it("a rate out of nothing is null, never 0 and never NaN", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 0)).toBeNull();
    expect(rate(5, -1)).toBeNull();
    expect(isNA(rate(1, 0))).toBe(true);
  });

  it("null in, null out — a missing numerator is not a zero one", () => {
    expect(rate(null, 40)).toBeNull();
    expect(rate(undefined, 40)).toBeNull();
    expect(rate(4, null)).toBeNull();
    expect(rate(4, undefined)).toBeNull();
  });

  it("refuses non-finite input rather than printing NaN% or ∞%", () => {
    expect(rate(Number.NaN, 40)).toBeNull();
    expect(rate(4, Number.NaN)).toBeNull();
    expect(rate(Number.POSITIVE_INFINITY, 40)).toBeNull();
  });

  it("isNA treats undefined and non-finite as unanswerable too", () => {
    expect(isNA(null)).toBe(true);
    expect(isNA(undefined)).toBe(true);
    expect(isNA(Number.NaN)).toBe(true);
    expect(isNA(0)).toBe(false);
  });
});

describe("rate rounding matches the SQL's one decimal place", () => {
  it("rounds the way round(x, 1) does", () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(2, 3)).toBe(66.7);
    expect(rate(4, 6)).toBe(66.7);
    expect(rate(5, 7)).toBe(71.4);
    expect(rate(1, 8)).toBe(12.5);
  });

  it("gives exactly 100 for a whole share, not 99.9", () => {
    expect(rate(7, 7)).toBe(100);
  });

  it("does not clamp above 100 — an over-booked seat should show as such", () => {
    expect(rate(120, 100)).toBe(120);
  });

  it("**matches the figures the Sprint 10 harness asserts in SQL**", () => {
    // These exact numbers are checked against the RPCs in
    // supabase/tests/run-sprint10-checks.sh. If one side changes, both fail.
    expect(settledRate(2, 2, 1, 1)).toBe(50); // appointments: 2 of 4 settled
    expect(settledRate(1, 2, 1, 1)).toBe(25); // no-show rate 25%
    expect(settledRate(4, 4, 1, 1)).toBe(66.7); // queue: 4 of 6 settled
    expect(rate(180, 4200)).toBe(4.3); // seat 2's utilization
    expect(rate(1, 2)).toBe(50); // referral conversion after a 2nd claim
    expect(rate(1, 1)).toBe(100); // reward use rate once the coupon is spent
  });
});

describe("settledRate", () => {
  it("is a share of what finished, so the three rates add to 100", () => {
    const completed = 2;
    const cancelled = 1;
    const noShow = 1;
    const sum =
      (settledRate(completed, completed, cancelled, noShow) ?? 0) +
      (settledRate(noShow, completed, cancelled, noShow) ?? 0) +
      (settledRate(cancelled, completed, cancelled, noShow) ?? 0);
    expect(sum).toBe(100);
  });

  it("ignores bookings that have not finished — an upcoming slot is neither", () => {
    // 10 booked for next week must not drag the completion rate down.
    expect(settledRate(2, 2, 1, 1)).toBe(50);
  });

  it("is null when nothing has settled yet, not 0%", () => {
    expect(settledRate(0, 0, 0, 0)).toBeNull();
  });
});

describe("utilization", () => {
  it("is booked over rostered minutes", () => {
    expect(utilization(180, 4200)).toBe(4.3);
    expect(utilization(2100, 4200)).toBe(50);
  });

  it("**is null when the roster is unknown — never a made-up denominator**", () => {
    expect(utilization(180, null)).toBeNull();
    expect(utilization(180, undefined)).toBeNull();
  });

  it("is 0, not null, for a rostered seat that took no work", () => {
    expect(utilization(0, 4200)).toBe(0);
  });

  it("is null for a roster of zero minutes — a closed week has no share", () => {
    expect(utilization(0, 0)).toBeNull();
  });
});

describe("average", () => {
  it("is null rather than 0 when there is nothing to average", () => {
    expect(average(0, 0)).toBeNull();
    expect(average(5900, 0)).toBeNull();
  });

  it("rounds to two places, like an amount of money", () => {
    expect(average(5900, 7)).toBe(842.86);
    expect(average(600, 4)).toBe(150);
  });
});

describe("shareOf and participationRate", () => {
  it("expresses one amount as a percentage of a total", () => {
    expect(shareOf(3200, 5900)).toBe(54.2);
    expect(shareOf(0, 5900)).toBe(0);
  });

  it("participation is null when the window served nobody", () => {
    expect(participationRate(3, 0)).toBeNull();
    expect(participationRate(3, null)).toBeNull();
  });

  it("is not clamped — a programme can hold more accounts than the window served", () => {
    expect(participationRate(6, 4)).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// trend
// ---------------------------------------------------------------------------

describe("summarizeTrend", () => {
  const points = [
    point({ bucket_start: "2026-09-09", revenue_total: 0, revenue_collected: 0, jobs: 0 }),
    point({ bucket_start: "2026-09-10", revenue_total: 1200, revenue_collected: 0, jobs: 1 }),
    point({ bucket_start: "2026-09-11", revenue_total: 2000, revenue_collected: 2000, jobs: 2 }),
    point({ bucket_start: "2026-09-12", revenue_total: 0, revenue_collected: 0, jobs: 0 }),
  ];

  it("totals every column across the buckets", () => {
    const summary = summarizeTrend(points);
    expect(summary.revenueTotal).toBe(3200);
    expect(summary.revenueCollected).toBe(2000);
    expect(summary.jobs).toBe(3);
  });

  it("names the best bucket", () => {
    expect(summarizeTrend(points).best?.bucket_start).toBe("2026-09-11");
  });

  it("**keeps quiet days in the average** — dropping them would inflate it", () => {
    // 3200 over four buckets, not over the two that had money in them.
    expect(summarizeTrend(points).perBucket).toBe(800);
  });

  it("is all zeros and no best bucket for an empty window", () => {
    const summary = summarizeTrend([]);
    expect(summary.revenueTotal).toBe(0);
    expect(summary.jobs).toBe(0);
    expect(summary.best).toBeNull();
    expect(summary.perBucket).toBeNull();
  });

  it("has no best bucket when every day is zero, rather than picking the first", () => {
    const summary = summarizeTrend([point(), point({ bucket_start: "2026-09-10" })]);
    expect(summary.best).toBeNull();
    expect(summary.perBucket).toBe(0);
  });

  it("never returns a zero scale, so a bar height cannot divide by zero", () => {
    expect(summarizeTrend([]).scale).toBe(1);
    expect(summarizeTrend([point()]).scale).toBe(1);
    expect(summarizeTrend(points).scale).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// peak slots
// ---------------------------------------------------------------------------

describe("slotBars", () => {
  const slots: PeakSlot[] = [
    slot("HOUR", "SERIAL", 12, 2),
    slot("HOUR", "SERIAL", 17, 1),
    slot("HOUR", "APPOINTMENT", 14, 1),
    slot("WEEKDAY", "SERIAL", 2, 3),
    slot("WEEKDAY", "SERIAL", 6, 1),
  ];

  it("**returns all 24 hours, quiet ones included**", () => {
    const bars = slotBars(slots, "HOUR", "SERIAL");
    expect(bars).toHaveLength(24);
    expect(bars[0]).toEqual({ bucket: 0, jobs: 0, isPeak: false });
    expect(bars[12]).toEqual({ bucket: 12, jobs: 2, isPeak: true });
    expect(bars[17]).toEqual({ bucket: 17, jobs: 1, isPeak: false });
  });

  it("keeps the two sources apart", () => {
    expect(slotBars(slots, "HOUR", "APPOINTMENT")[14].jobs).toBe(1);
    expect(slotBars(slots, "HOUR", "APPOINTMENT")[12].jobs).toBe(0);
  });

  it("returns the week Saturday-first, the way the rest of the app reads it", () => {
    const bars = slotBars(slots, "WEEKDAY", "SERIAL");
    expect(bars.map((b) => b.bucket)).toEqual([...WEEK_ORDER_ISODOW]);
    expect(bars).toHaveLength(7);
  });

  it("marks the busiest weekday wherever it sits in that order", () => {
    const bars = slotBars(slots, "WEEKDAY", "SERIAL");
    expect(bars.find((b) => b.isPeak)?.bucket).toBe(2);
  });

  it("marks nothing as peak when nothing happened", () => {
    const bars = slotBars([], "HOUR", "SERIAL");
    expect(bars.every((b) => !b.isPeak)).toBe(true);
    expect(bars.every((b) => b.jobs === 0)).toBe(true);
  });

  it("breaks a tie on the earliest bucket, so the badge does not wander", () => {
    const tied = [slot("HOUR", "SERIAL", 18, 2), slot("HOUR", "SERIAL", 10, 2)];
    expect(peakSlot(tied, "HOUR", "SERIAL")?.bucket).toBe(10);
  });

  it("adds up duplicate rows for one bucket instead of taking the last", () => {
    const doubled = [slot("HOUR", "SERIAL", 12, 2), slot("HOUR", "SERIAL", 12, 3)];
    expect(slotBars(doubled, "HOUR", "SERIAL")[12].jobs).toBe(5);
  });

  it("slotTotal counts one kind/source pair only", () => {
    expect(slotTotal(slots, "HOUR", "SERIAL")).toBe(3);
    expect(slotTotal(slots, "HOUR", "APPOINTMENT")).toBe(1);
    expect(slotTotal(slots, "WEEKDAY", "APPOINTMENT")).toBe(0);
  });
});

describe("hourWindow", () => {
  it("opens on the working day when everything is inside it", () => {
    const bars = slotBars([slot("HOUR", "SERIAL", 12, 2)], "HOUR", "SERIAL");
    expect(hourWindow(bars)).toEqual({ from: 8, to: 22 });
  });

  it("**stretches to cover an early or late job — never hides one**", () => {
    const bars = slotBars(
      [slot("HOUR", "SERIAL", 6, 1), slot("HOUR", "SERIAL", 23, 1)],
      "HOUR",
      "SERIAL",
    );
    expect(hourWindow(bars)).toEqual({ from: 6, to: 23 });
  });

  it("never narrows below the working day just because the shop was quiet", () => {
    expect(hourWindow(slotBars([], "HOUR", "SERIAL"))).toEqual({ from: 8, to: 22 });
  });
});

// ---------------------------------------------------------------------------
// staff
// ---------------------------------------------------------------------------

describe("sortStaff", () => {
  it("puts the highest earner first", () => {
    const rows = [
      staff({ staff_id: "a", revenue_total: 1000 }),
      staff({ staff_id: "b", revenue_total: 3000 }),
    ];
    expect(sortStaff(rows).map((r) => r.staff_id)).toEqual(["b", "a"]);
  });

  it("breaks a revenue tie on job count", () => {
    const rows = [
      staff({ staff_id: "a", revenue_total: 1000, jobs_total: 2 }),
      staff({ staff_id: "b", revenue_total: 1000, jobs_total: 5 }),
    ];
    expect(sortStaff(rows).map((r) => r.staff_id)).toEqual(["b", "a"]);
  });

  it("does not mutate the cached array it was given", () => {
    const rows = [
      staff({ staff_id: "a", revenue_total: 1000 }),
      staff({ staff_id: "b", revenue_total: 3000 }),
    ];
    sortStaff(rows);
    expect(rows.map((r) => r.staff_id)).toEqual(["a", "b"]);
  });
});

describe("summarizeStaff", () => {
  it("totals jobs and revenue across the seats", () => {
    const summary = summarizeStaff([
      staff({ staff_id: "a", jobs_total: 4, revenue_total: 3100 }),
      staff({ staff_id: "b", jobs_total: 2, revenue_total: 2500 }),
    ]);
    expect(summary.seats).toBe(2);
    expect(summary.jobs).toBe(6);
    expect(summary.revenue).toBe(5600);
  });

  it("**pools the minutes rather than averaging the percentages**", () => {
    // Averaging would give (100 + 10) / 2 = 55%. Pooling gives 1100/6000.
    const summary = summarizeStaff([
      staff({ staff_id: "a", booked_minutes: 600, working_minutes: 600 }),
      staff({ staff_id: "b", booked_minutes: 540, working_minutes: 5400 }),
    ]);
    expect(summary.utilizationPct).toBe(19);
  });

  it("**leaves a seat with no roster out of both sides of the fraction**", () => {
    const summary = summarizeStaff([
      staff({ staff_id: "a", booked_minutes: 300, working_minutes: 600 }),
      staff({ staff_id: "b", booked_minutes: 480, working_minutes: null }),
    ]);
    expect(summary.seatsWithHours).toBe(1);
    expect(summary.utilizationPct).toBe(50);
  });

  it("is null overall when no seat has a roster at all", () => {
    const summary = summarizeStaff([staff({ working_minutes: null })]);
    expect(summary.seatsWithHours).toBe(0);
    expect(summary.utilizationPct).toBeNull();
  });

  it("names the busiest seat, and none at all when nobody worked", () => {
    expect(
      summarizeStaff([
        staff({ staff_id: "a", jobs_total: 1 }),
        staff({ staff_id: "b", jobs_total: 6 }),
      ]).busiest?.staff_id,
    ).toBe("b");
    expect(summarizeStaff([staff({ jobs_total: 0 })]).busiest).toBeNull();
  });

  it("is empty and null for a shop with no seats", () => {
    const summary = summarizeStaff([]);
    expect(summary.seats).toBe(0);
    expect(summary.utilizationPct).toBeNull();
    expect(summary.busiest).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// breakdowns
// ---------------------------------------------------------------------------

describe("topBreakdown", () => {
  const rows: BreakdownRow[] = [
    { key: "s1", label: "ফেসিয়াল", jobs: 4, amount: 3100 },
    { key: "s2", label: "হেয়ারকাট", jobs: 2, amount: 2500 },
    { key: "s3", label: "শেভ", jobs: 1, amount: 300 },
  ];

  it("orders by amount and works out each share of the total", () => {
    const result = topBreakdown(rows);
    expect(result.rows.map((r) => r.key)).toEqual(["s1", "s2", "s3"]);
    expect(result.total).toBe(5900);
    expect(result.rows[0].share).toBe(52.5);
  });

  it("**accounts for what it trimmed, so a top-N cannot read as everything**", () => {
    const result = topBreakdown(rows, 2);
    expect(result.rows).toHaveLength(2);
    expect(result.rest).toEqual({ count: 1, amount: 300 });
    // The shares are still of the real total, not of the two shown.
    expect(result.rows[0].share).toBe(52.5);
  });

  it("is empty, not broken, for a period with nothing in it", () => {
    const result = topBreakdown([]);
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.rest).toEqual({ count: 0, amount: 0 });
    expect(result.scale).toBe(1);
  });

  it("gives every row a null share when the total is zero", () => {
    const result = topBreakdown([{ key: "x", label: "x", jobs: 1, amount: 0 }]);
    expect(result.rows[0].share).toBeNull();
  });

  it("does not mutate the cached array", () => {
    const copy = [...rows].reverse();
    const before = copy.map((r) => r.key);
    topBreakdown(copy);
    expect(copy.map((r) => r.key)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// retention
// ---------------------------------------------------------------------------

describe("summarizeRetention", () => {
  // The shop-A figures the Sprint 10 harness asserts: 4 served, 3 new, 1
  // returning, 1 of them in more than once.
  const overview = {
    customers_unique: 4,
    customers_new: 3,
    customers_returning: 1,
    customers_repeat: 1,
  };

  it("turns the counts into rates out of the customers served", () => {
    const summary = summarizeRetention(overview)!;
    expect(summary.newRate).toBe(75);
    expect(summary.returningRate).toBe(25);
    expect(summary.repeatRate).toBe(25);
  });

  it("**keeps returning and repeat apart — one is history, one is this period**", () => {
    // A customer who came before AND twice this week is in both counts, so the
    // two are never added together or treated as a partition.
    const summary = summarizeRetention({
      customers_unique: 2,
      customers_new: 1,
      customers_returning: 1,
      customers_repeat: 2,
    })!;
    expect(summary.returningCount).toBe(1);
    expect(summary.repeatCount).toBe(2);
    expect(summary.newCount + summary.returningCount).toBe(summary.unique);
  });

  it("is all-null rates for a period that served nobody, not zeros", () => {
    const summary = summarizeRetention({
      customers_unique: 0,
      customers_new: 0,
      customers_returning: 0,
      customers_repeat: 0,
    })!;
    expect(summary.unique).toBe(0);
    expect(summary.newRate).toBeNull();
    expect(summary.repeatRate).toBeNull();
  });

  it("is null for an overview that never arrived", () => {
    expect(summarizeRetention(null)).toBeNull();
    expect(summarizeRetention(undefined)).toBeNull();
  });
});
