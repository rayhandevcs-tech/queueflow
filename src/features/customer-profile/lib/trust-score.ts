export interface TrustSummary {
  visitCount: number;
  noShowCount: number;
  regularShopCount: number;
  /** null = not enough history yet (no DONE/NO_SHOW serials at all). */
  score: number | null;
}

export interface HistorySerialRow {
  shop_id: string;
  status: string;
}

const REGULAR_VISIT_THRESHOLD = 2;

/** Pure aggregation over a customer's full serial history — no I/O. */
export function computeTrustSummary(rows: HistorySerialRow[]): TrustSummary {
  let visitCount = 0;
  let noShowCount = 0;
  const byShop = new Map<string, number>();

  for (const row of rows) {
    if (row.status === "DONE") {
      visitCount += 1;
      byShop.set(row.shop_id, (byShop.get(row.shop_id) ?? 0) + 1);
    } else if (row.status === "NO_SHOW") {
      noShowCount += 1;
    }
  }

  const relevant = visitCount + noShowCount;
  const regularShopCount = [...byShop.values()].filter((n) => n >= REGULAR_VISIT_THRESHOLD).length;

  return {
    visitCount,
    noShowCount,
    regularShopCount,
    score: relevant > 0 ? Math.round((visitCount / relevant) * 5 * 10) / 10 : null,
  };
}
