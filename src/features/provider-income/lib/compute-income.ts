import { BN_MONTHS_SHORT, EN_MONTHS_SHORT } from "@/lib/format-wait";
import { parseServicesSnapshot, type Json } from "@/types";
import type { Language } from "@/lib/i18n";

export interface DoneSerialRow {
  completed_at: string | null;
  total_amount: number;
  services_snapshot: Json;
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

export interface IncomeSummary {
  today: { amount: number; doneCount: number };
  month: { amount: number; changePct: number | null };
  year: { amount: number };
  /** Oldest → newest, always exactly 12 points ending at the current month. */
  monthlyTrend: MonthlyPoint[];
  /** This month, sorted highest first. */
  byService: ServiceIncome[];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Pure aggregation over "DONE this year-ish" rows — no I/O, easy to test. */
export function computeIncomeSummary(rows: DoneSerialRow[], now: Date, lang: Language = "bn"): IncomeSummary {
  const MONTHS_SHORT = lang === "en" ? EN_MONTHS_SHORT : BN_MONTHS_SHORT;
  const todayKey = now.toDateString();
  const thisMonthKey = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = monthKey(lastMonthDate);
  const thisYear = now.getFullYear();

  let todayAmount = 0;
  let todayCount = 0;
  let monthAmount = 0;
  let lastMonthAmount = 0;
  let yearAmount = 0;
  const byMonth = new Map<string, number>();
  const byService = new Map<string, number>();

  for (const row of rows) {
    if (!row.completed_at) continue;
    const at = new Date(row.completed_at);
    const key = monthKey(at);

    byMonth.set(key, (byMonth.get(key) ?? 0) + row.total_amount);

    if (at.toDateString() === todayKey) {
      todayAmount += row.total_amount;
      todayCount += 1;
    }
    if (key === thisMonthKey) {
      monthAmount += row.total_amount;
      for (const s of parseServicesSnapshot(row.services_snapshot)) {
        byService.set(s.name, (byService.get(s.name) ?? 0) + s.rate);
      }
    }
    if (key === lastMonthKey) lastMonthAmount += row.total_amount;
    if (at.getFullYear() === thisYear) yearAmount += row.total_amount;
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
    lastMonthAmount > 0 ? Math.round(((monthAmount - lastMonthAmount) / lastMonthAmount) * 100) : null;

  return {
    today: { amount: todayAmount, doneCount: todayCount },
    month: { amount: monthAmount, changePct },
    year: { amount: yearAmount },
    monthlyTrend,
    byService: [...byService.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
