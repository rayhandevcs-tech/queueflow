import { describe, expect, it } from "vitest";
import { computeSpendingSummary, type SpendingSerialRow } from "./compute-spending";

const NOW = new Date("2026-07-30T12:00:00.000Z");

function row(overrides: Partial<SpendingSerialRow>): SpendingSerialRow {
  return {
    shop_id: "shop-1",
    completed_at: NOW.toISOString(),
    total_amount: 150,
    ...overrides,
  };
}

describe("computeSpendingSummary", () => {
  it("returns all-zero summary for no rows", () => {
    const summary = computeSpendingSummary([], NOW);
    expect(summary.month).toEqual({ amount: 0, changePct: null });
    expect(summary.year).toEqual({ amount: 0 });
    expect(summary.total).toEqual({ amount: 0 });
    expect(summary.monthlyTrend).toHaveLength(12);
    expect(summary.byShop).toEqual([]);
  });

  it("skips rows with no completed_at", () => {
    const summary = computeSpendingSummary([row({ completed_at: null })], NOW);
    expect(summary.total.amount).toBe(0);
  });

  it("accumulates total across all time regardless of month", () => {
    const rows = [
      row({ completed_at: "2026-07-15T12:00:00.000Z", total_amount: 150 }),
      row({ completed_at: "2025-01-01T12:00:00.000Z", total_amount: 200 }),
    ];
    const summary = computeSpendingSummary(rows, NOW);
    expect(summary.total.amount).toBe(350);
    expect(summary.month.amount).toBe(150);
    expect(summary.year.amount).toBe(150);
  });

  it("groups spend and visit count per shop, sorted highest spend first", () => {
    const rows = [
      row({ shop_id: "s1", total_amount: 100 }),
      row({ shop_id: "s2", total_amount: 500 }),
      row({ shop_id: "s1", total_amount: 100 }),
    ];
    const summary = computeSpendingSummary(rows, NOW);
    expect(summary.byShop).toEqual([
      { shopId: "s2", amount: 500, visitCount: 1 },
      { shopId: "s1", amount: 200, visitCount: 2 },
    ]);
  });

  it("computes month-over-month change percentage the same way as income", () => {
    const rows = [
      row({ completed_at: "2026-07-15T12:00:00.000Z", total_amount: 300 }),
      row({ completed_at: "2026-06-15T12:00:00.000Z", total_amount: 150 }),
    ];
    const summary = computeSpendingSummary(rows, NOW);
    expect(summary.month.changePct).toBe(100);
  });

  it("uses English month labels when lang is en", () => {
    const summary = computeSpendingSummary([row({})], NOW, "en");
    expect(summary.monthlyTrend[11].label).toBe("Jul");
  });
});
