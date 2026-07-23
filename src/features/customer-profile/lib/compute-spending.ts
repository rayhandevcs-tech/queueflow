import { BN_MONTHS_SHORT } from "@/lib/format-wait";

export interface SpendingSerialRow {
  shop_id: string;
  completed_at: string | null;
  total_amount: number;
}

export interface MonthlySpendPoint {
  label: string;
  amount: number;
  isCurrent: boolean;
}

export interface ShopSpend {
  shopId: string;
  amount: number;
  visitCount: number;
}

export interface SpendingSummary {
  month: { amount: number; changePct: number | null };
  year: { amount: number };
  total: { amount: number };
  /** Oldest → newest, always exactly 12 points ending at the current month. */
  monthlyTrend: MonthlySpendPoint[];
  /** All-time, sorted highest spend first. */
  byShop: ShopSpend[];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Pure aggregation over a customer's DONE serials — no I/O, mirrors provider-income's compute-income. */
export function computeSpendingSummary(rows: SpendingSerialRow[], now: Date): SpendingSummary {
  const thisMonthKey = monthKey(now);
  const lastMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const thisYear = now.getFullYear();

  let monthAmount = 0;
  let lastMonthAmount = 0;
  let yearAmount = 0;
  let totalAmount = 0;
  const byMonth = new Map<string, number>();
  const byShop = new Map<string, { amount: number; visitCount: number }>();

  for (const row of rows) {
    if (!row.completed_at) continue;
    const at = new Date(row.completed_at);
    const key = monthKey(at);

    byMonth.set(key, (byMonth.get(key) ?? 0) + row.total_amount);

    const shop = byShop.get(row.shop_id) ?? { amount: 0, visitCount: 0 };
    shop.amount += row.total_amount;
    shop.visitCount += 1;
    byShop.set(row.shop_id, shop);

    totalAmount += row.total_amount;
    if (key === thisMonthKey) monthAmount += row.total_amount;
    if (key === lastMonthKey) lastMonthAmount += row.total_amount;
    if (at.getFullYear() === thisYear) yearAmount += row.total_amount;
  }

  const monthlyTrend: MonthlySpendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyTrend.push({
      label: BN_MONTHS_SHORT[d.getMonth()],
      amount: byMonth.get(monthKey(d)) ?? 0,
      isCurrent: i === 0,
    });
  }

  const changePct =
    lastMonthAmount > 0 ? Math.round(((monthAmount - lastMonthAmount) / lastMonthAmount) * 100) : null;

  return {
    month: { amount: monthAmount, changePct },
    year: { amount: yearAmount },
    total: { amount: totalAmount },
    monthlyTrend,
    byShop: [...byShop.entries()]
      .map(([shopId, v]) => ({ shopId, amount: v.amount, visitCount: v.visitCount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
