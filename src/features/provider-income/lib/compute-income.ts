import { BN_MONTHS_SHORT, EN_MONTHS_SHORT } from "@/lib/format-wait";
import { parseServicesSnapshot, type Json } from "@/types";
import type { Language } from "@/lib/i18n";

export interface DoneSerialRow {
  completed_at: string | null;
  total_amount: number;
  services_snapshot: Json;
  payment_status: "PAID" | "DUE";
  chair_id: string | null;
}

/** One "কাজ শেষ, সিরিয়াল ছাড়া" entry — already resolved to a service name at read time. */
export interface ManualEntryRow {
  created_at: string;
  amount: number;
  service_name: string;
  chair_id: string | null;
  payment_status: "PAID" | "DUE";
}

export interface MonthlyPoint {
  label: string;
  amount: number;
  isCurrent: boolean;
}

export interface ServiceIncome {
  name: string;
  amount: number;
}

export interface StaffIncome {
  chairId: string;
  amount: number;
}

/** Total business done in a period, split by whether it was actually collected. */
export interface PeriodTotal {
  amount: number;
  cash: number;
  due: number;
}

export interface IncomeSummary {
  today: PeriodTotal & { doneCount: number };
  month: PeriodTotal & { changePct: number | null };
  year: PeriodTotal;
  /** Oldest → newest, always exactly 12 points ending at the current month. */
  monthlyTrend: MonthlyPoint[];
  /** This month, sorted highest first. */
  byService: ServiceIncome[];
  /** This month, sorted highest first — chairId to be resolved to a name/avatar by the caller. */
  byStaff: StaffIncome[];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function emptyPeriod(): PeriodTotal {
  return { amount: 0, cash: 0, due: 0 };
}

function addToPeriod(period: PeriodTotal, amount: number, status: "PAID" | "DUE"): void {
  period.amount += amount;
  if (status === "DUE") period.due += amount;
  else period.cash += amount;
}

/**
 * Pure aggregation over completed-work rows from two sources (serials +
 * manual entries) — no I/O, easy to test. Every period total is "total
 * business done" (cash + due combined), with cash/due broken out
 * separately — a due amount still counts as work done today, just not yet
 * collected.
 */
export function computeIncomeSummary(
  serialRows: DoneSerialRow[],
  manualRows: ManualEntryRow[],
  now: Date,
  lang: Language = "bn",
): IncomeSummary {
  const MONTHS_SHORT = lang === "en" ? EN_MONTHS_SHORT : BN_MONTHS_SHORT;
  const todayKey = now.toDateString();
  const thisMonthKey = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = monthKey(lastMonthDate);
  const thisYear = now.getFullYear();

  const today = emptyPeriod();
  let todayCount = 0;
  const month = emptyPeriod();
  let lastMonthAmount = 0;
  const year = emptyPeriod();
  const byMonth = new Map<string, number>();
  const byService = new Map<string, number>();
  const byStaff = new Map<string, number>();

  function apply(
    at: Date,
    amount: number,
    status: "PAID" | "DUE",
    chairId: string | null,
    services: ServiceIncome[],
  ): void {
    const key = monthKey(at);
    byMonth.set(key, (byMonth.get(key) ?? 0) + amount);

    if (at.toDateString() === todayKey) {
      addToPeriod(today, amount, status);
      todayCount += 1;
    }
    if (key === thisMonthKey) {
      addToPeriod(month, amount, status);
      for (const s of services) byService.set(s.name, (byService.get(s.name) ?? 0) + s.amount);
      if (chairId) byStaff.set(chairId, (byStaff.get(chairId) ?? 0) + amount);
    }
    if (key === lastMonthKey) lastMonthAmount += amount;
    if (at.getFullYear() === thisYear) addToPeriod(year, amount, status);
  }

  for (const row of serialRows) {
    if (!row.completed_at) continue;
    const services = parseServicesSnapshot(row.services_snapshot).map((s) => ({
      name: s.name,
      amount: s.rate,
    }));
    apply(new Date(row.completed_at), row.total_amount, row.payment_status, row.chair_id, services);
  }

  for (const row of manualRows) {
    apply(new Date(row.created_at), row.amount, row.payment_status, row.chair_id, [
      { name: row.service_name, amount: row.amount },
    ]);
  }

  const monthlyTrend: MonthlyPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyTrend.push({
      label: MONTHS_SHORT[d.getMonth()],
      amount: byMonth.get(monthKey(d)) ?? 0,
      isCurrent: i === 0,
    });
  }

  const changePct =
    lastMonthAmount > 0 ? Math.round(((month.amount - lastMonthAmount) / lastMonthAmount) * 100) : null;

  return {
    today: { ...today, doneCount: todayCount },
    month: { ...month, changePct },
    year,
    monthlyTrend,
    byService: [...byService.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    byStaff: [...byStaff.entries()]
      .map(([chairId, amount]) => ({ chairId, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
