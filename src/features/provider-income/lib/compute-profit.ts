import type { ExpenseCategory } from "@/types";
import type { DoneSerialRow, ManualEntryRow } from "./compute-income";

export interface ExpenseRow {
  /** `spent_on` — the day the money was *for*, which is what a month's total means. */
  spent_on: string;
  amount: number;
  category: ExpenseCategory;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  amount: number;
}

export interface ExpenseSummary {
  today: number;
  month: number;
  year: number;
  /** This month, biggest first. */
  byCategory: CategoryTotal[];
  /** Oldest → newest, 12 points ending this month — aligns with the income trend. */
  monthlyTrend: number[];
}

function monthKey(y: number, m: number): string {
  return `${y}-${m}`;
}

/**
 * `spent_on` is a plain date (`YYYY-MM-DD`), so it must be read as local time.
 * `new Date("2026-08-05")` parses as UTC midnight, which in Asia/Dhaka is the
 * 5th at 06:00 — harmless here, but the same string in a UTC-negative timezone
 * would land on the 4th and quietly move an expense into the previous month.
 */
function parseSpentOn(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function computeExpenseSummary(rows: ExpenseRow[], now: Date): ExpenseSummary {
  const todayKey = now.toDateString();
  const thisMonth = monthKey(now.getFullYear(), now.getMonth());
  const thisYear = now.getFullYear();

  let today = 0;
  let month = 0;
  let year = 0;
  const byCategory = new Map<ExpenseCategory, number>();
  const byMonth = new Map<string, number>();

  for (const row of rows) {
    const at = parseSpentOn(row.spent_on);
    const key = monthKey(at.getFullYear(), at.getMonth());
    byMonth.set(key, (byMonth.get(key) ?? 0) + row.amount);

    if (at.toDateString() === todayKey) today += row.amount;
    if (key === thisMonth) {
      month += row.amount;
      byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
    }
    if (at.getFullYear() === thisYear) year += row.amount;
  }

  const monthlyTrend: number[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyTrend.push(byMonth.get(monthKey(d.getFullYear(), d.getMonth())) ?? 0);
  }

  return {
    today,
    month,
    year,
    byCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    monthlyTrend,
  };
}

export interface StaffEarning {
  chairId: string;
  jobs: number;
  /** Money actually in hand — the only base commission is paid on. */
  collected: number;
  /** Work done but still owed by the customer; commission follows once it lands. */
  pending: number;
  commissionPct: number;
  /** commissionPct% of `collected`. */
  staffShare: number;
  /** What's left of `collected` for the shop. */
  shopShare: number;
  /** What the staff member will be owed on top, once `pending` is collected. */
  pendingShare: number;
}

/** Just the fields this computation needs, so callers aren't forced to pass whole chair rows. */
export interface CommissionChair {
  id: string;
  commission_pct: number;
}

/**
 * Per-staff takings and commission for a period.
 *
 * Commission accrues on **collected** money only. That is the honest default
 * and the one a shop would insist on: a customer who took a haircut on credit
 * hasn't paid the shop anything yet, so paying the barber his cut out of it
 * would mean the shop financing the debt. `pendingShare` still shows what will
 * be owed once that balance comes in, so nothing looks like it vanished.
 */
export function computeStaffEarnings(
  serialRows: DoneSerialRow[],
  manualRows: ManualEntryRow[],
  chairs: CommissionChair[],
  from: Date,
  to: Date,
): StaffEarning[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const acc = new Map<string, { jobs: number; collected: number; pending: number }>();

  const add = (
    chairId: string | null,
    at: string | null,
    amount: number,
    status: "PAID" | "DUE",
  ) => {
    if (!chairId || !at) return;
    const ms = new Date(at).getTime();
    if (ms < fromMs || ms >= toMs) return;

    const entry = acc.get(chairId) ?? { jobs: 0, collected: 0, pending: 0 };
    entry.jobs += 1;
    if (status === "DUE") entry.pending += amount;
    else entry.collected += amount;
    acc.set(chairId, entry);
  };

  for (const row of serialRows) {
    add(row.chair_id, row.completed_at, row.total_amount, row.payment_status);
  }
  for (const row of manualRows) {
    add(row.chair_id, row.created_at, row.amount, row.payment_status);
  }

  return chairs
    .map((chair) => {
      const entry = acc.get(chair.id) ?? { jobs: 0, collected: 0, pending: 0 };
      const pct = chair.commission_pct ?? 0;
      const staffShare = Math.round((entry.collected * pct) / 100);
      return {
        chairId: chair.id,
        jobs: entry.jobs,
        collected: entry.collected,
        pending: entry.pending,
        commissionPct: pct,
        staffShare,
        shopShare: entry.collected - staffShare,
        pendingShare: Math.round((entry.pending * pct) / 100),
      };
    })
    .sort((a, b) => b.collected + b.pending - (a.collected + a.pending));
}
