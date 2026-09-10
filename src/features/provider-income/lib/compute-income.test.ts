import { describe, expect, it } from "vitest";
import {
  computeIncomeSummary,
  type DoneAppointmentRow,
  type DoneSerialRow,
  type ManualEntryRow,
} from "./compute-income";

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

function appointmentRow(overrides: Partial<DoneAppointmentRow> = {}): DoneAppointmentRow {
  return {
    completed_at: NOW.toISOString(),
    total_amount: 500,
    services_snapshot: [
      { service_id: "p1", name: "Facial", rate: 500, estimated_duration_min: 45 },
    ],
    payment_status: "PAID",
    staff_id: null,
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

  // ---- Sprint 5 hardening: completed parlour appointments ----

  it("leaves every total untouched when no appointments are passed", () => {
    const rows = [row({ total_amount: 150 })];
    expect(computeIncomeSummary(rows, [], NOW)).toEqual(
      computeIncomeSummary(rows, [], NOW, "bn", []),
    );
  });

  it("counts a completed appointment into today, the month and the year", () => {
    const summary = computeIncomeSummary([], [], NOW, "bn", [appointmentRow({ total_amount: 500 })]);
    expect(summary.today).toEqual({ amount: 500, cash: 500, due: 0, doneCount: 1 });
    expect(summary.month.amount).toBe(500);
    expect(summary.year.amount).toBe(500);
  });

  it("splits an unpaid appointment into due, not cash — the same rule serials get", () => {
    const summary = computeIncomeSummary([], [], NOW, "bn", [
      appointmentRow({ total_amount: 500, payment_status: "DUE" }),
    ]);
    expect(summary.today).toEqual({ amount: 500, cash: 0, due: 500, doneCount: 1 });
  });

  it("skips an appointment with no completed_at — booked is not earned", () => {
    const summary = computeIncomeSummary([], [], NOW, "bn", [
      appointmentRow({ completed_at: null, total_amount: 500 }),
    ]);
    expect(summary.today.amount).toBe(0);
  });

  it("counts an appointment at its completed_at, not at its scheduled day", () => {
    // Completed last month: it belongs to last month's takings even though a
    // shop reading `starts_at` would have filed it under today.
    const summary = computeIncomeSummary([], [], NOW, "bn", [
      appointmentRow({ completed_at: "2026-06-15T12:00:00.000Z", total_amount: 400 }),
    ]);
    expect(summary.today.amount).toBe(0);
    expect(summary.month.amount).toBe(0);
    expect(summary.monthlyTrend.at(-2)!.amount).toBe(400);
  });

  it("merges appointments with serials and manual entries into one set of totals", () => {
    const summary = computeIncomeSummary(
      [row({ total_amount: 150, chair_id: "chair-1" })],
      [manualRow({ amount: 100, chair_id: "chair-2" })],
      NOW,
      "bn",
      [appointmentRow({ total_amount: 500, staff_id: "chair-3" })],
    );
    expect(summary.today).toEqual({ amount: 750, cash: 750, due: 0, doneCount: 3 });
    expect(summary.byStaff).toEqual([
      { chairId: "chair-3", amount: 500 },
      { chairId: "chair-1", amount: 150 },
      { chairId: "chair-2", amount: 100 },
    ]);
  });

  it("splits an appointment by its snapshot services, so a repriced service cannot rewrite it", () => {
    const summary = computeIncomeSummary([], [], NOW, "bn", [
      appointmentRow({
        total_amount: 800,
        services_snapshot: [
          { service_id: "p1", name: "Facial", rate: 500, estimated_duration_min: 45 },
          { service_id: "p2", name: "Threading", rate: 300, estimated_duration_min: 15 },
        ],
      }),
    ]);
    expect(summary.byService).toEqual([
      { name: "Facial", amount: 500 },
      { name: "Threading", amount: 300 },
    ]);
  });

  it("adds an appointment's amount to the same staff bucket as that person's serials", () => {
    const summary = computeIncomeSummary(
      [row({ total_amount: 150, chair_id: "chair-1" })],
      [],
      NOW,
      "bn",
      [appointmentRow({ total_amount: 500, staff_id: "chair-1" })],
    );
    expect(summary.byStaff).toEqual([{ chairId: "chair-1", amount: 650 }]);
  });

  it("leaves an appointment with no staff_id out of byStaff without losing the money", () => {
    const summary = computeIncomeSummary([], [], NOW, "bn", [
      appointmentRow({ total_amount: 500, staff_id: null }),
    ]);
    expect(summary.today.amount).toBe(500);
    expect(summary.byStaff).toEqual([]);
  });
});
