import type { ExpenseCategory } from "@/types";

/**
 * One shop's money movement, from three tables, on one timeline.
 *
 * The income page answers "how much"; this answers "from whom, and on what".
 * They read the same rows but arrive at different shapes, so the merge lives
 * here as a pure function rather than inside a component — a ledger is exactly
 * the kind of thing that should be testable without a browser.
 */
export type TransactionKind = "SERIAL" | "MANUAL" | "EXPENSE";

export interface Transaction {
  id: string;
  kind: TransactionKind;
  /** Positive for money in, negative for money out. */
  amount: number;
  /** Epoch ms — sorting key and the only date the UI formats. */
  atMs: number;
  /** Who or what this was: a customer's name, or the expense's note. */
  title: string;
  /** The service list, the expense category label — the second line. */
  subtitle: string | null;
  avatarUrl: string | null;
  /** Money in that hasn't been collected yet. Expenses are never pending. */
  unpaid: boolean;
  /** cash / bkash / … — null for dues and expenses. */
  method: string | null;
  expenseCategory: ExpenseCategory | null;
}

export interface SerialTxRow {
  id: string;
  completed_at: string | null;
  total_amount: number;
  payment_status: string;
  payment_method: string | null;
  customer_name: string | null;
  customer_avatar_url: string | null;
  party_member_name: string | null;
  is_walk_in: boolean;
  services_snapshot: unknown;
}

export interface ManualTxRow {
  id: string;
  amount: number;
  created_at: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string | null;
  note: string | null;
}

export interface ExpenseTxRow {
  id: string;
  amount: number;
  spent_on: string;
  category: ExpenseCategory;
  note: string | null;
}

function serviceNames(snapshot: unknown): string | null {
  if (!Array.isArray(snapshot)) return null;
  const names = snapshot
    .map((s) => (s && typeof s === "object" && "name" in s ? String(s.name) : null))
    .filter((n): n is string => !!n);
  return names.length ? names.join(", ") : null;
}

export interface BuildOptions {
  /** "অফ-লাইন কাস্টমার" etc. — the fallback when no name was taken. */
  walkInLabel: string;
  manualLabel: string;
  expenseLabel: (category: ExpenseCategory) => string;
}

export function buildTransactions(
  serials: readonly SerialTxRow[],
  manual: readonly ManualTxRow[],
  expenses: readonly ExpenseTxRow[],
  opts: BuildOptions,
): Transaction[] {
  const out: Transaction[] = [];

  for (const s of serials) {
    // A serial with no completed_at never finished, so no money moved.
    if (!s.completed_at) continue;
    out.push({
      id: s.id,
      kind: "SERIAL",
      amount: s.total_amount,
      atMs: new Date(s.completed_at).getTime(),
      title: s.party_member_name || s.customer_name || opts.walkInLabel,
      subtitle: serviceNames(s.services_snapshot),
      avatarUrl: s.customer_avatar_url,
      unpaid: s.payment_status === "DUE",
      method: s.payment_method,
      expenseCategory: null,
    });
  }

  for (const m of manual) {
    out.push({
      id: m.id,
      kind: "MANUAL",
      amount: m.amount,
      atMs: new Date(m.created_at).getTime(),
      title: m.customer_name || opts.manualLabel,
      subtitle: m.note,
      avatarUrl: null,
      unpaid: m.payment_status === "DUE",
      method: m.payment_method,
      expenseCategory: null,
    });
  }

  for (const e of expenses) {
    out.push({
      id: e.id,
      kind: "EXPENSE",
      amount: -e.amount,
      // spent_on is a date, not a timestamp: rent paid late belongs to the day
      // it was for. Noon avoids a timezone shift dragging it to the day before.
      atMs: new Date(`${e.spent_on}T12:00:00`).getTime(),
      title: e.note?.trim() || opts.expenseLabel(e.category),
      subtitle: e.note?.trim() ? opts.expenseLabel(e.category) : null,
      avatarUrl: null,
      unpaid: false,
      method: null,
      expenseCategory: e.category,
    });
  }

  return out.sort((a, b) => b.atMs - a.atMs);
}

export interface TransactionTotals {
  /** Money actually collected. */
  inflow: number;
  /** Money spent. Positive number. */
  outflow: number;
  /** Earned but not yet collected — deliberately outside inflow. */
  pending: number;
  net: number;
}

export function totalsOf(rows: readonly Transaction[]): TransactionTotals {
  let inflow = 0;
  let outflow = 0;
  let pending = 0;

  for (const r of rows) {
    if (r.amount < 0) outflow += -r.amount;
    else if (r.unpaid) pending += r.amount;
    else inflow += r.amount;
  }

  return { inflow, outflow, pending, net: inflow - outflow };
}

/** Groups a sorted list into day buckets, newest day first. */
export function groupByDay(
  rows: readonly Transaction[],
): Array<{ dayMs: number; rows: Transaction[] }> {
  const days: Array<{ dayMs: number; rows: Transaction[] }> = [];
  for (const r of rows) {
    const d = new Date(r.atMs);
    const dayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const last = days[days.length - 1];
    if (last && last.dayMs === dayMs) last.rows.push(r);
    else days.push({ dayMs, rows: [r] });
  }
  return days;
}
