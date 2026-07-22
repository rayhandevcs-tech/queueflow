export interface ReviewRow {
  id: string;
  serial_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ReviewSummary {
  average: number | null;
  count: number;
  /** Index 0 → 5★, index 4 → 1★. */
  distribution: { stars: number; pct: number; count: number }[];
}

export function computeReviewSummary(rows: ReviewRow[]): ReviewSummary {
  const count = rows.length;
  if (count === 0) {
    return {
      average: null,
      count: 0,
      distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, pct: 0, count: 0 })),
    };
  }

  const counts = new Map<number, number>();
  let sum = 0;
  for (const r of rows) {
    counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);
    sum += r.rating;
  }

  return {
    average: Math.round((sum / count) * 10) / 10,
    count,
    distribution: [5, 4, 3, 2, 1].map((stars) => {
      const c = counts.get(stars) ?? 0;
      return { stars, count: c, pct: Math.round((c / count) * 100) };
    }),
  };
}
