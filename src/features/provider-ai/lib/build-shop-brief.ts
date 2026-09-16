/**
 * One shop, compressed into the facts an analyst would actually ask for.
 *
 * Both AI features read this and nothing else. That is the point: the analysis
 * card and the chat cannot disagree about last month's revenue if there is only
 * one place the number comes from, and a pure function is something we can test
 * without spending money on a model call.
 *
 * It is deliberately numbers, not prose. Handing the model a paragraph of our own
 * interpretation would mean it is analysing our summary rather than the shop —
 * and any mistake in that summary becomes a confident mistake in the answer.
 *
 * Size matters here too: this becomes the cached prompt prefix on every chat
 * turn, so every list is capped. A shop with four hundred services does not
 * produce a four-hundred-line brief.
 */

const TOP_SERVICES = 8;
const TOP_STAFF = 10;
const RECENT_COMPLAINTS = 5;

export interface BriefSerial {
  completed_at: string | null;
  created_at: string;
  total_amount: number;
  payment_status: string;
  status: string;
  chair_id: string | null;
  customer_id: string | null;
  services_snapshot: unknown;
}

export interface BriefManualEntry {
  created_at: string;
  amount: number;
  payment_status: string;
}

export interface BriefExpense {
  spent_on: string;
  amount: number;
  category: string;
}

export interface BriefReview {
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface BriefChair {
  id: string;
  label: string;
  staff_name: string | null;
  is_active: boolean;
}

export interface BriefService {
  name: string;
  rate: number;
  default_duration_min: number;
  is_active: boolean;
}

export interface MonthStat {
  /** "2026-08" — the model reads these as a series, so keep them sortable. */
  month: string;
  revenue: number;
  jobs: number;
  /** Earned but not collected, kept out of revenue. */
  due: number;
  expenses: number;
}

/**
 * The Sprint 10 aggregates, exactly as the analytics RPCs returned them.
 *
 * Every number here was computed **in Postgres**, over the shop's own rows,
 * behind `is_shop_owner`. The brief carries them through unchanged rather than
 * recomputing anything: the AI then answers from the same figures the owner is
 * reading on the analytics page, so the assistant and the dashboard cannot
 * disagree about last month's no-show rate.
 *
 * Every field is `number | null` where the RPC's is, and every block is
 * nullable. A null is not a zero — it means "this cannot be calculated" (no
 * appointments to have a no-show rate) or "this programme is off". The prompt
 * tells the model to treat it that way.
 */
export interface ProgrammeBrief {
  /** The window these aggregates cover, "YYYY-MM-DD", both ends inclusive. */
  window: { from: string; to: string };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    upcoming: number;
    completionRate: number | null;
    noShowRate: number | null;
    cancelRate: number | null;
    avgScheduledMin: number | null;
    avgLeadDays: number | null;
  } | null;
  queue: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    completionRate: number | null;
    avgServiceMin: number | null;
    avgWaitMin: number | null;
  } | null;
  loyalty: {
    enabled: boolean;
    accounts: number;
    outstandingPoints: number;
    earnedPoints: number;
    redeemedPoints: number;
    referralPoints: number;
    transactions: number;
  } | null;
  membership: {
    tiersActive: number;
    activeMembers: number;
    pendingMembers: number;
    expiredMembers: number;
    expiringSoon: number;
    newInWindow: number;
    /** Collected only. There is no recurring billing to project from. */
    revenueCollected: number;
    revenueDue: number;
  } | null;
  referral: {
    enabled: boolean;
    total: number;
    pending: number;
    /** Sprint 8's definition: a claimed code is not a conversion. */
    converted: number;
    conversionRate: number | null;
    customersBrought: number;
    pointsAwarded: number;
  } | null;
  rewards: {
    total: number;
    active: number;
    redemptionsIssued: number;
    redemptionsUsed: number;
    redemptionsExpired: number;
    useRate: number | null;
    pointsSpent: number;
    discountGiven: number;
  } | null;
}

export interface ShopBrief {
  shopName: string;
  businessType: string;
  generatedAt: string;
  currency: "BDT";

  months: MonthStat[];
  topServices: Array<{ name: string; jobs: number; revenue: number }>;
  staff: Array<{ name: string; jobs: number; revenue: number }>;
  /** 0-23, only hours that ever saw a booking. */
  busiestHours: Array<{ hour: number; jobs: number }>;
  /** 0 = Sunday, matching Date.getDay(). */
  busiestDays: Array<{ day: number; jobs: number }>;
  customers: {
    unique: number;
    returning: number;
    walkIns: number;
    cancelled: number;
    noShows: number;
  };
  expensesByCategory: Array<{ category: string; amount: number }>;
  outstanding: { jobs: number; amount: number };
  reviews: {
    count: number;
    average: number | null;
    recentComplaints: string[];
  };
  catalogue: {
    activeServices: number;
    activeStaff: number;
    priceRange: { min: number; max: number } | null;
  };
  /**
   * Sprint 10's aggregates, or null when they could not be read.
   *
   * Null rather than a block of zeros on purpose: a shop whose analytics call
   * failed has not told us it has no appointments, and a model shown zeros
   * would confidently say the parlour side is dead.
   */
  programmes: ProgrammeBrief | null;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function serviceNames(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot
    .map((s) => (s && typeof s === "object" && "name" in s ? String(s.name) : null))
    .filter((n): n is string => !!n);
}

/** Descending by `value`, then capped — used for every "top N" list below. */
function topN<T>(map: Map<string, T>, value: (v: T) => number, n: number): T[] {
  return [...map.values()].sort((a, b) => value(b) - value(a)).slice(0, n);
}

export function buildShopBrief(input: {
  shopName: string;
  businessType: string;
  serials: readonly BriefSerial[];
  manualEntries: readonly BriefManualEntry[];
  expenses: readonly BriefExpense[];
  reviews: readonly BriefReview[];
  chairs: readonly BriefChair[];
  services: readonly BriefService[];
  /** Pre-computed analytics from the Sprint 10 RPCs. Optional and nullable. */
  programmes?: ProgrammeBrief | null;
  now?: Date;
}): ShopBrief {
  const now = input.now ?? new Date();

  const months = new Map<string, MonthStat>();
  const month = (key: string): MonthStat => {
    let m = months.get(key);
    if (!m) {
      m = { month: key, revenue: 0, jobs: 0, due: 0, expenses: 0 };
      months.set(key, m);
    }
    return m;
  };

  const serviceStats = new Map<string, { name: string; jobs: number; revenue: number }>();
  const staffStats = new Map<string, { name: string; jobs: number; revenue: number }>();
  const hours = new Map<number, number>();
  const days = new Map<number, number>();
  const customerJobs = new Map<string, number>();

  let walkIns = 0;
  let cancelled = 0;
  let noShows = 0;
  let dueJobs = 0;
  let dueAmount = 0;

  const chairName = new Map(
    input.chairs.map((c) => [c.id, c.staff_name || c.label] as const),
  );

  for (const s of input.serials) {
    if (s.status === "CANCELLED") {
      cancelled += 1;
      continue;
    }
    if (s.status === "NO_SHOW") {
      noShows += 1;
      continue;
    }
    // Anything else that never completed moved no money and taught us nothing.
    if (s.status !== "DONE" || !s.completed_at) continue;

    const isDue = s.payment_status === "DUE";
    const m = month(monthKey(s.completed_at));
    m.jobs += 1;
    if (isDue) {
      m.due += s.total_amount;
      dueJobs += 1;
      dueAmount += s.total_amount;
    } else {
      m.revenue += s.total_amount;
    }

    const at = new Date(s.completed_at);
    hours.set(at.getHours(), (hours.get(at.getHours()) ?? 0) + 1);
    days.set(at.getDay(), (days.get(at.getDay()) ?? 0) + 1);

    if (s.customer_id) {
      customerJobs.set(s.customer_id, (customerJobs.get(s.customer_id) ?? 0) + 1);
    } else {
      walkIns += 1;
    }

    const names = serviceNames(s.services_snapshot);
    // A multi-service job's money is split evenly rather than counted whole
    // against each service — otherwise the per-service revenue adds up to more
    // than the shop earned, which is the kind of number that quietly poisons
    // every conclusion drawn from it.
    const share = names.length > 0 ? s.total_amount / names.length : 0;
    for (const name of names) {
      const entry = serviceStats.get(name) ?? { name, jobs: 0, revenue: 0 };
      entry.jobs += 1;
      entry.revenue += share;
      serviceStats.set(name, entry);
    }

    if (s.chair_id) {
      const name = chairName.get(s.chair_id) ?? s.chair_id;
      const entry = staffStats.get(s.chair_id) ?? { name, jobs: 0, revenue: 0 };
      entry.jobs += 1;
      entry.revenue += s.total_amount;
      staffStats.set(s.chair_id, entry);
    }
  }

  for (const e of input.manualEntries) {
    const m = month(monthKey(e.created_at));
    m.jobs += 1;
    if (e.payment_status === "DUE") {
      m.due += e.amount;
      dueJobs += 1;
      dueAmount += e.amount;
    } else {
      m.revenue += e.amount;
    }
    walkIns += 1;
  }

  const expensesByCategory = new Map<string, number>();
  for (const e of input.expenses) {
    month(monthKey(e.spent_on)).expenses += e.amount;
    expensesByCategory.set(e.category, (expensesByCategory.get(e.category) ?? 0) + e.amount);
  }

  const rated = input.reviews.filter((r) => Number.isFinite(r.rating));
  const average =
    rated.length > 0
      ? Math.round((rated.reduce((sum, r) => sum + r.rating, 0) / rated.length) * 10) / 10
      : null;

  const activeServices = input.services.filter((s) => s.is_active);
  const rates = activeServices.map((s) => s.rate).filter((r) => Number.isFinite(r));

  return {
    shopName: input.shopName,
    businessType: input.businessType,
    generatedAt: now.toISOString(),
    currency: "BDT",

    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    topServices: topN(serviceStats, (s) => s.revenue, TOP_SERVICES).map((s) => ({
      ...s,
      revenue: Math.round(s.revenue),
    })),
    staff: topN(staffStats, (s) => s.revenue, TOP_STAFF),
    busiestHours: [...hours.entries()]
      .map(([hour, jobs]) => ({ hour, jobs }))
      .sort((a, b) => b.jobs - a.jobs),
    busiestDays: [...days.entries()]
      .map(([day, jobs]) => ({ day, jobs }))
      .sort((a, b) => b.jobs - a.jobs),
    customers: {
      unique: customerJobs.size,
      returning: [...customerJobs.values()].filter((n) => n > 1).length,
      walkIns,
      cancelled,
      noShows,
    },
    expensesByCategory: [...expensesByCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    outstanding: { jobs: dueJobs, amount: dueAmount },
    reviews: {
      count: rated.length,
      average,
      recentComplaints: rated
        .filter((r) => r.rating <= 3 && r.comment?.trim())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, RECENT_COMPLAINTS)
        .map((r) => r.comment!.trim()),
    },
    catalogue: {
      activeServices: activeServices.length,
      activeStaff: input.chairs.filter((c) => c.is_active).length,
      priceRange:
        rates.length > 0 ? { min: Math.min(...rates), max: Math.max(...rates) } : null,
    },
    // Passed straight through. Not merged into the figures above, and not
    // recomputed from the rows: the serial-derived numbers here and the
    // RPC-derived ones cover deliberately different windows and definitions,
    // and quietly blending two definitions of "revenue" is how a brief starts
    // contradicting the dashboard.
    programmes: input.programmes ?? null,
  };
}
