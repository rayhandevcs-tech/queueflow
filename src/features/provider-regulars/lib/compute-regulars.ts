import { translate } from "@/lib/i18n";
import { providerRegularsDict } from "./i18n";

export interface VisitRow {
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  completed_at: string | null;
  status: string;
}

export interface RegularCustomer {
  /** customer_id if a registered customer, else `phone:<number>` — walk-ins with no phone can't be tracked. */
  key: string;
  customerId: string | null;
  customerPhone: string | null;
  name: string;
  visitCount: number;
  lastVisitAt: string;
  visitedThisMonth: boolean;
}

const REGULAR_VISIT_THRESHOLD = 2;

/** Pure grouping over a shop's DONE serials — no I/O. */
export function computeRegulars(rows: VisitRow[], now: Date): RegularCustomer[] {
  const byKey = new Map<string, RegularCustomer>();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  for (const row of rows) {
    if (row.status !== "DONE" || !row.completed_at) continue;
    const key = row.customer_id ? row.customer_id : row.customer_phone ? `phone:${row.customer_phone}` : null;
    if (!key) continue;

    const existing = byKey.get(key);
    const completedAt = new Date(row.completed_at);
    const visitMonthKey = `${completedAt.getFullYear()}-${completedAt.getMonth()}`;
    const isThisMonth = visitMonthKey === thisMonthKey;

    if (!existing) {
      byKey.set(key, {
        key,
        customerId: row.customer_id,
        customerPhone: row.customer_phone,
        name: row.customer_name || translate(providerRegularsDict, "customerFallback"),
        visitCount: 1,
        lastVisitAt: row.completed_at,
        visitedThisMonth: isThisMonth,
      });
    } else {
      existing.visitCount += 1;
      if (new Date(row.completed_at) > new Date(existing.lastVisitAt)) {
        existing.lastVisitAt = row.completed_at;
        existing.name = row.customer_name || existing.name;
      }
      existing.visitedThisMonth = existing.visitedThisMonth || isThisMonth;
    }
  }

  return [...byKey.values()]
    .filter((c) => c.visitCount >= REGULAR_VISIT_THRESHOLD)
    .sort((a, b) => {
      if (a.visitedThisMonth !== b.visitedThisMonth) return a.visitedThisMonth ? 1 : -1;
      return new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime();
    });
}
