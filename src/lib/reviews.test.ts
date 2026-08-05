import { describe, expect, it } from "vitest";
import { computeReviewSummary, type ReviewRow } from "./reviews";

function row(overrides: Partial<ReviewRow>): ReviewRow {
  return {
    id: "r1",
    serial_id: "s1",
    rating: 5,
    comment: null,
    images: [],
    chair_id: null,
    created_at: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("computeReviewSummary", () => {
  it("returns a null average and zeroed distribution for no reviews", () => {
    const summary = computeReviewSummary([]);
    expect(summary.average).toBeNull();
    expect(summary.count).toBe(0);
    expect(summary.distribution).toEqual([
      { stars: 5, pct: 0, count: 0 },
      { stars: 4, pct: 0, count: 0 },
      { stars: 3, pct: 0, count: 0 },
      { stars: 2, pct: 0, count: 0 },
      { stars: 1, pct: 0, count: 0 },
    ]);
  });

  it("computes the average rating rounded to 1 decimal", () => {
    const rows = [row({ rating: 5 }), row({ rating: 4 }), row({ rating: 4 })];
    const summary = computeReviewSummary(rows);
    expect(summary.average).toBe(4.3); // 13/3 = 4.333...
    expect(summary.count).toBe(3);
  });

  it("buckets counts and percentages per star rating", () => {
    const rows = [row({ rating: 5 }), row({ rating: 5 }), row({ rating: 3 }), row({ rating: 1 })];
    const summary = computeReviewSummary(rows);
    expect(summary.distribution).toEqual([
      { stars: 5, pct: 50, count: 2 },
      { stars: 4, pct: 0, count: 0 },
      { stars: 3, pct: 25, count: 1 },
      { stars: 2, pct: 0, count: 0 },
      { stars: 1, pct: 25, count: 1 },
    ]);
  });

  it("keeps distribution ordered 5-star first, 1-star last regardless of input order", () => {
    const rows = [row({ rating: 1 }), row({ rating: 5 })];
    const summary = computeReviewSummary(rows);
    expect(summary.distribution.map((d) => d.stars)).toEqual([5, 4, 3, 2, 1]);
  });
});
