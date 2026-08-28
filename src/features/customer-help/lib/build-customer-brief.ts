/**
 * The customer's own situation, compressed.
 *
 * Only what a support answer could actually need: where their booking stands,
 * what they owe, where they usually go. Deliberately narrow — this text is sent
 * to a model on every question, so anything that would not change an answer is
 * cost and exposure for nothing.
 *
 * Pure, so the shape of what leaves the device is decided in one testable place
 * rather than scattered across a route handler.
 */

const RECENT_VISITS = 5;

export interface BriefActiveSerial {
  position: number;
  status: string;
  estimated_start_at: string | null;
  started_at: string | null;
  estimated_duration_min: number;
  called_at: string | null;
  arrived_at: string | null;
  is_walk_in: boolean;
  shop_name: string | null;
  services: string[];
  total_amount: number;
  /** How many are ahead on the same chair — the answer to the top question. */
  aheadOnChair: number;
}

export interface BriefPastVisit {
  completed_at: string;
  shop_name: string | null;
  services: string[];
  total_amount: number;
  payment_status: string;
}

export interface CustomerBrief {
  name: string | null;
  generatedAt: string;
  currency: "BDT";
  hasAccount: true;

  activeBooking: BriefActiveSerial | null;
  recentVisits: BriefPastVisit[];
  outstanding: { visits: number; amount: number };
  habits: {
    totalVisits: number;
    cancelled: number;
    noShows: number;
    usualShop: string | null;
    usualService: string | null;
  };
}

function mostCommon(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
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

export function buildCustomerBrief(input: {
  name: string | null;
  activeBooking: BriefActiveSerial | null;
  history: readonly {
    completed_at: string | null;
    status: string;
    payment_status: string;
    total_amount: number;
    due_amount: number;
    shop_name: string | null;
    services: string[];
  }[];
  now?: Date;
}): CustomerBrief {
  const now = input.now ?? new Date();

  const done = input.history.filter((h) => h.status === "DONE" && h.completed_at);
  const cancelled = input.history.filter((h) => h.status === "CANCELLED").length;
  const noShows = input.history.filter((h) => h.status === "NO_SHOW").length;

  const unpaid = done.filter((h) => h.payment_status === "DUE");

  const recentVisits = [...done]
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, RECENT_VISITS)
    .map((h) => ({
      completed_at: h.completed_at!,
      shop_name: h.shop_name,
      services: h.services,
      total_amount: h.total_amount,
      payment_status: h.payment_status,
    }));

  return {
    name: input.name,
    generatedAt: now.toISOString(),
    currency: "BDT",
    hasAccount: true,

    activeBooking: input.activeBooking,
    recentVisits,
    outstanding: {
      visits: unpaid.length,
      // due_amount is what the shop recorded as still owed; total_amount is the
      // bill. Summing the bill would overstate what they owe on a job that was
      // partly settled.
      amount: unpaid.reduce((sum, h) => sum + (h.due_amount || h.total_amount), 0),
    },
    habits: {
      totalVisits: done.length,
      cancelled,
      noShows,
      usualShop: mostCommon(done.map((h) => h.shop_name).filter((s): s is string => !!s)),
      usualService: mostCommon(done.flatMap((h) => h.services)),
    },
  };
}
