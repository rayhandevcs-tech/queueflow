export interface AnalyticsRow {
  completed_at: string | null;
  started_at: string | null;
}

export interface LoadBucket {
  /** Chart axis label, matching the design handoff's own abbreviations. */
  short: string;
  count: number;
  isPeak: boolean;
}

export interface AnalyticsSummary {
  hasData: boolean;
  dailyAvgCustomers: number | null;
  peakHourLabel: string | null;
  avgServiceMin: number | null;
  hourlyLoad: LoadBucket[];
  weeklyLoad: LoadBucket[];
  insights: string[];
}

// Two-hour buckets, 8am–midnight. The design handoff's demo starts at 10am;
// widened to 8am here so shops that open earlier don't silently lose their
// morning activity from the peak-time KPI and chart.
const HOUR_BUCKETS = [
  { from: 8, to: 10, short: "8a", full: "সকাল ৮টা - ১০টা" },
  { from: 10, to: 12, short: "10a", full: "সকাল ১০টা - দুপুর ১২টা" },
  { from: 12, to: 14, short: "12p", full: "দুপুর ১২টা - ২টা" },
  { from: 14, to: 16, short: "2p", full: "দুপুর ২টা - বিকাল ৪টা" },
  { from: 16, to: 18, short: "4p", full: "বিকাল ৪টা - সন্ধ্যা ৬টা" },
  { from: 18, to: 20, short: "6p", full: "সন্ধ্যা ৬টা - ৮টা" },
  { from: 20, to: 22, short: "8p", full: "রাত ৮টা - ১০টা" },
  { from: 22, to: 24, short: "10p", full: "রাত ১০টা - ১২টা" },
] as const;

// Bangladesh work-week order, Saturday first.
const WEEK_DAYS = [
  { jsDay: 6, short: "শনি" },
  { jsDay: 0, short: "রবি" },
  { jsDay: 1, short: "সোম" },
  { jsDay: 2, short: "মঙ্গল" },
  { jsDay: 3, short: "বুধ" },
  { jsDay: 4, short: "বৃহ" },
  { jsDay: 5, short: "শুক্র" },
] as const;

function bucketIndexForHour(hour: number): number {
  return HOUR_BUCKETS.findIndex((b) => hour >= b.from && hour < b.to);
}

function peakIndex(counts: number[]): number | null {
  let best = -1;
  let bestCount = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > bestCount) {
      bestCount = counts[i];
      best = i;
    }
  }
  return bestCount > 0 ? best : null;
}

function quietIndex(counts: number[]): number | null {
  let best = -1;
  let bestCount = Infinity;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0 && counts[i] < bestCount) {
      bestCount = counts[i];
      best = i;
    }
  }
  return best >= 0 ? best : null;
}

/** Pure aggregation over DONE-serial history — no I/O, easy to test. */
export function computeAnalyticsSummary(rows: AnalyticsRow[]): AnalyticsSummary {
  const hourCounts = new Array(HOUR_BUCKETS.length).fill(0);
  const weekCounts = new Array(WEEK_DAYS.length).fill(0);
  const daysWithActivity = new Set<string>();
  let totalDurationMin = 0;
  let durationSamples = 0;
  let total = 0;

  for (const row of rows) {
    if (!row.completed_at) continue;
    const completedAt = new Date(row.completed_at);
    total += 1;
    daysWithActivity.add(completedAt.toDateString());

    const hourBucket = bucketIndexForHour(completedAt.getHours());
    if (hourBucket >= 0) hourCounts[hourBucket] += 1;

    const weekIdx = WEEK_DAYS.findIndex((d) => d.jsDay === completedAt.getDay());
    if (weekIdx >= 0) weekCounts[weekIdx] += 1;

    if (row.started_at) {
      const min = (completedAt.getTime() - new Date(row.started_at).getTime()) / 60_000;
      if (min > 0) {
        totalDurationMin += min;
        durationSamples += 1;
      }
    }
  }

  const hourlyPeak = peakIndex(hourCounts);
  const weeklyPeak = peakIndex(weekCounts);
  const hourlyQuiet = quietIndex(hourCounts);

  const hourlyLoad: LoadBucket[] = HOUR_BUCKETS.map((b, i) => ({
    short: b.short,
    count: hourCounts[i],
    isPeak: i === hourlyPeak,
  }));
  const weeklyLoad: LoadBucket[] = WEEK_DAYS.map((d, i) => ({
    short: d.short,
    count: weekCounts[i],
    isPeak: i === weeklyPeak,
  }));

  const insights: string[] = [];
  if (hourlyPeak !== null && weeklyPeak !== null) {
    insights.push(
      `${WEEK_DAYS[weeklyPeak].short}বার ${HOUR_BUCKETS[hourlyPeak].full} সবচেয়ে ব্যস্ত — অতিরিক্ত কর্মী রাখতে পারো।`,
    );
  }
  if (hourlyQuiet !== null && hourlyQuiet !== hourlyPeak) {
    insights.push(`${HOUR_BUCKETS[hourlyQuiet].full} তুলনামূলক ফাঁকা থাকে — ডিসকাউন্ট দিয়ে কাস্টমার টানতে পারো।`);
  }

  return {
    hasData: total > 0,
    dailyAvgCustomers: daysWithActivity.size > 0 ? Math.round(total / daysWithActivity.size) : null,
    peakHourLabel: hourlyPeak !== null ? HOUR_BUCKETS[hourlyPeak].full : null,
    avgServiceMin: durationSamples > 0 ? Math.round(totalDurationMin / durationSamples) : null,
    hourlyLoad,
    weeklyLoad,
    insights,
  };
}
