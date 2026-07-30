import { describe, expect, it } from "vitest";
import { computeIncomeSummary, type DoneSerialRow } from "./compute-income";

const NOW = new Date("2026-07-30T12:00:00.000Z");

function row(overrides: Partial<DoneSerialRow>): DoneSerialRow {
  return {
    completed_at: NOW.toISOString(),
    total_amount: 150,
    services_snapshot: [{ service_id: "s1", name: "Haircut", rate: 150, estimated_duration_min: 20 }],
    ...overrides,
  };
}

describe("computeIncomeSummary", () => {
  it("returns all-zero summary for no rows", () => {
    const summary = computeIncomeSummary([], NOW);
    expect(summary.today).toEqual({ amount: 0, doneCount: 0 });
    expect(summary.month).toEqual({ amount: 0, changePct: null });
    expect(summary.year).toEqual({ amount: 0 });
    expect(summary.monthlyTrend).toHaveLength(12);
    expect(summary.byService).toEqual([]);
  });

  it("skips rows with no completed_at", () => {
    const summary = computeIncomeSummary([row({ completed_at: null })], NOW);
    expect(summary.today.amount).toBe(0);
  });

  it("sums today's amount and count only for rows completed today", () => {
    const rows = [
      row({ completed_at: NOW.toISOString(), total_amount: 100 }),
      row({ completed_at: NOW.toISOString(), total_amount: 50 }),
      row({ completed_at: "2026-07-01T12:00:00.000Z", total_amount: 999 }),
    ];
    const summary = computeIncomeSummary(rows, NOW);
    expect(summary.today).toEqual({ amount: 150, doneCount: 2 });
  });

  it("computes month-over-month change percentage", () => {
    const rows = [
      row({ completed_at: "2026-07-15T12:00:00.000Z", total_amount: 300 }), // this month
      row({ completed_at: "2026-06-15T12:00:00.000Z", total_amount: 200 }), // last month
    ];
    const summary = computeIncomeSummary(rows, NOW);
    expect(summary.month.amount).toBe(300);
    expect(summary.month.changePct).toBe(50); // (300-200)/200 * 100
  });

  it("changePct is null when there was no income last month", () => {
    const rows = [row({ completed_at: "2026-07-15T12:00:00.000Z", total_amount: 300 })];
    const summary = computeIncomeSummary(rows, NOW);
    expect(summary.month.changePct).toBeNull();
  });

  it("produces exactly 12 monthly-trend points ending at the current month", () => {
    const summary = computeIncomeSummary([row({})], NOW);
    expect(summary.monthlyTrend).toHaveLength(12);
    expect(summary.monthlyTrend[11].isCurrent).toBe(true);
    expect(summary.monthlyTrend[11].label).toBe("জুল");
    expect(summary.monthlyTrend.slice(0, 11).every((p) => !p.isCurrent)).toBe(true);
  });

  it("uses English month labels when lang is en", () => {
    const summary = computeIncomeSummary([row({})], NOW, "en");
    expect(summary.monthlyTrend[11].label).toBe("Jul");
  });

  it("only aggregates by-service income for the current month's rows", () => {
    const rows = [
      row({
        completed_at: "2026-07-15T12:00:00.000Z",
        services_snapshot: [{ service_id: "s1", name: "Haircut", rate: 150, estimated_duration_min: 20 }],
      }),
      row({
        completed_at: "2026-06-15T12:00:00.000Z", // last month, should be excluded
        services_snapshot: [{ service_id: "s2", name: "Shave", rate: 80, estimated_duration_min: 10 }],
      }),
    ];
    const summary = computeIncomeSummary(rows, NOW);
    expect(summary.byService).toEqual([{ name: "Haircut", amount: 150 }]);
  });

  it("sorts byService highest amount first", () => {
    const rows = [
      row({
        completed_at: "2026-07-15T12:00:00.000Z",
        services_snapshot: [{ service_id: "s1", name: "Shave", rate: 80, estimated_duration_min: 10 }],
      }),
      row({
        completed_at: "2026-07-16T12:00:00.000Z",
        services_snapshot: [{ service_id: "s2", name: "Haircut", rate: 150, estimated_duration_min: 20 }],
      }),
    ];
    const summary = computeIncomeSummary(rows, NOW);
    expect(summary.byService.map((s) => s.name)).toEqual(["Haircut", "Shave"]);
  });
});
