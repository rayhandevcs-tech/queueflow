import type { Serial } from "@/types";

export interface CustomerHabits {
  /** Average days between visits — null until there are at least two. */
  avgDaysBetween: number | null;
  /** Days since the last completed visit; null if there's never been one. */
  daysSinceLast: number | null;
  /** True once `daysSinceLast` exceeds the customer's own usual gap. */
  overdue: boolean;
  visitCount: number;
  favouriteShopId: string | null;
  favouriteChairId: string | null;
  /** A sensible reminder interval derived from their actual rhythm, or null. */
  suggestedIntervalDays: number | null;
}

const DAY_MS = 86_400_000;

function mode(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The customer's own rhythm, from serials they already have.
 *
 * Only DONE visits count. A cancelled booking says nothing about how often
 * someone actually gets a haircut, and counting it would shorten the average
 * — producing a reminder that arrives too early, which is exactly the way to
 * make someone turn reminders off.
 */
export function computeHabits(serials: Serial[], now: Date = new Date()): CustomerHabits {
  const visits = serials
    .filter((s) => s.status === "DONE" && s.completed_at)
    .map((s) => ({
      at: new Date(s.completed_at!).getTime(),
      shopId: s.shop_id,
      chairId: s.chair_id,
    }))
    .sort((a, b) => a.at - b.at);

  const visitCount = visits.length;
  if (visitCount === 0) {
    return {
      avgDaysBetween: null,
      daysSinceLast: null,
      overdue: false,
      visitCount: 0,
      favouriteShopId: null,
      favouriteChairId: null,
      suggestedIntervalDays: null,
    };
  }

  let avgDaysBetween: number | null = null;
  if (visitCount >= 2) {
    // Span over gaps, not a mean of individual gaps — same number, but it
    // doesn't drift when two visits land on the same day.
    const spanDays = (visits[visitCount - 1].at - visits[0].at) / DAY_MS;
    const gaps = visitCount - 1;
    avgDaysBetween = Math.max(1, Math.round(spanDays / gaps));
  }

  const daysSinceLast = Math.floor((now.getTime() - visits[visitCount - 1].at) / DAY_MS);

  return {
    avgDaysBetween,
    daysSinceLast,
    overdue: avgDaysBetween !== null && daysSinceLast > avgDaysBetween,
    visitCount,
    favouriteShopId: mode(visits.map((v) => v.shopId)),
    favouriteChairId: mode(visits.map((v) => v.chairId)),
    // Rounded to whole weeks: nobody thinks "every 19 days", and the reminder
    // reads as a decision the customer made rather than a number we derived.
    suggestedIntervalDays:
      avgDaysBetween === null ? null : Math.min(180, Math.max(7, Math.round(avgDaysBetween / 7) * 7)),
  };
}
