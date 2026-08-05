import { describe, expect, it } from "vitest";
import { computeIncomeSummary, type DoneSerialRow, type ManualEntryRow } from "./compute-income";

const NOW = new Date("2026-07-30T12:00:00.000Z");

function row(overrides: Partial<DoneSerialRow>): DoneSerialRow {
  return {
    completed_at: NOW.toISOString(),
    total_amount: 150,
    services_snapshot: [{ service_id: "s1", name: "Haircut", rate: 150, estimated_duration_min: 20 }],
    payment_status: "PAID",
    chair_id: null,
    ...overrides,
  };
}

function manualRow(overrides: Partial<ManualEntryRow>): ManualEntryRow {
  return {
    created_at: NOW.toISOString(),
    amount: 100,
    service_name: "Shave",
    chair_id: null,
    payment_status: "PAID",
    ...overrides,
  };
}

describe("computeIncomeSummary", () => {
  it("returns all-zero summary for no rows", () => {
    const summary = computeIncomeSummary([], [], NOW);
    expect(summary.today).toEqual({ amount: 0, cash: 0, due: 0, doneCount: 0 });
    expect(summary.month).toEqual({ amount: 0, cash: 0, due: 0, changePct: null });
    expect(summary.year).toEqual({ amount: 0, cash: 0, due: 0 });
    expect(summary.monthlyTrend).toHaveLength(12);
    expect(summary.byService).toEqual([]);
    expect(summary.byStaff).toEqual([]);
  });

  it("skips rows with no completed_at", () => {
    const summary = computeIncomeSummary([row({ completed_at: null })], [], NOW);
    expect(summary.today.amount).toBe(0);
  });

  it("sums today's amount and count only for rows completed today", () => {
    const rows = [
      row({ completed_at: NOW.toISOString(), total_amount: 100 }),
      row({ completed_at: NOW.toISOString(), total_amount: 50 }),
      row({ completed_at: "2026-07-01T12:00:00.000Z", total_amount: 999 }),
    ];
    const summary = computeIncomeSummary(rows, [], NOW);
    expect(summary.today).toEqual({ amount: 150, cash: 150, due: 0, doneCount: 2 });
  });

  it("computes month-over-month change percentage", () => {
    const rows = [
      row({ completed_at: "2026-07-15T12:00:00.000Z", total_amount: 300 }), // this month
      row({ completed_at: "2026-06-15T12:00:00.000Z", total_amount: 200 }), // last month
    ];
    const summary = computeIncomeSummary(rows, [], NOW);
    expect(summary.month.amount).toBe(300);
    expect(summary.month.changePct).toBe(50); // (300-200)/200 * 100
  });

  it("changePct is null when there was no income last month", () => {
    const rows = [row({ completed_at: "2026-07-15T12:00:00.000Z", total_amount: 300 })];
    const summary = computeIncomeSummary(rows, [], NOW);
    expect(summary.month.changePct).toBeNull();
  });

  it("produces exactly 12 monthly-trend points ending at the current month", () => {
    const summary = computeIncomeSummary([row({})], [], NOW);
    expect(summary.monthlyTrend).toHaveLength(12);
    expect(summary.monthlyTrend[11].isCurrent).toBe(true);
    expect(summary.monthlyTrend[11].label).toBe("জুল");
    expect(summary.monthlyTrend.slice(0, 11).every((p) => !p.isCurrent)).toBe(true);
  });

  it("uses English month labels when lang is en", () => {
    const summary = computeIncomeSummary([row({})], [], NOW, "en");
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
    const summary = computeIncomeSummary(rows, [], NOW);
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
    const summary = computeIncomeSummary(rows, [], NOW);
    expect(summary.byService.map((s) => s.name)).toEqual(["Haircut", "Shave"]);
  });

  it("splits a period's total into cash vs due", () => {
    const rows = [
      row({ completed_at: NOW.toISOString(), total_amount: 100, payment_status: "PAID" }),
      row({ completed_at: NOW.toISOString(), total_amount: 60, payment_status: "DUE" }),
    ];
    const summary = computeIncomeSummary(rows, [], NOW);
    expect(summary.today).toEqual({ amount: 160, cash: 100, due: 60, doneCount: 2 });
  });

  it("merges manual entries into every total, byService, and byStaff", () => {
    const rows = [row({ completed_at: NOW.toISOString(), total_amount: 150, chair_id: "chair-1" })];
    const manual = [
      manualRow({ created_at: NOW.toISOString(), amount: 100, service_name: "Shave", chair_id: "chair-2" }),
    ];
    const summary = computeIncomeSummary(rows, manual, NOW);
    expect(summary.today).toEqual({ amount: 250, cash: 250, due: 0, doneCount: 2 });
    expect(summary.byService).toEqual([
      { name: "Haircut", amount: 150 },
      { name: "Shave", amount: 100 },
    ]);
    expect(summary.byStaff).toEqual([
      { chairId: "chair-1", amount: 150 },
      { chairId: "chair-2", amount: 100 },
    ]);
  });

  it("a due manual entry still counts toward the total but not cash", () => {
    const manual = [manualRow({ created_at: NOW.toISOString(), amount: 100, payment_status: "DUE" })];
    const summary = computeIncomeSummary([], manual, NOW);
    expect(summary.today).toEqual({ amount: 100, cash: 0, due: 100, doneCount: 1 });
  });

  it("excludes rows with no chair_id from byStaff, without affecting other totals", () => {
    const rows = [row({ completed_at: NOW.toISOString(), total_amount: 150, chair_id: null })];
    const summary = computeIncomeSummary(rows, [], NOW);
    expect(summary.today.amount).toBe(150);
    expect(summary.byStaff).toEqual([]);
  });

  it("sums byStaff amounts across multiple entries for the same chair", () => {
    const rows = [
      row({ completed_at: "2026-07-05T12:00:00.000Z", total_amount: 150, chair_id: "chair-1" }),
      row({ completed_at: "2026-07-20T12:00:00.000Z", total_amount: 50, chair_id: "chair-1" }),
    ];
    const summary = computeIncomeSummary(rows, [], NOW);
    expect(summary.byStaff).toEqual([{ chairId: "chair-1", amount: 200 }]);
    expect(summary.byStaff.reduce((sum, s) => sum + s.amount, 0)).toBe(summary.month.amount);
  });
});
