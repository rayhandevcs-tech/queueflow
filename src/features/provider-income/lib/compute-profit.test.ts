import { describe, expect, it } from "vitest";
import {
  computeExpenseSummary,
  computeStaffEarnings,
  type ExpenseRow,
} from "./compute-profit";
import type { DoneSerialRow, ManualEntryRow } from "./compute-income";

const NOW = new Date(2026, 7, 15, 12, 0, 0); // 15 Aug 2026, local

function expense(over: Partial<ExpenseRow> = {}): ExpenseRow {
  return { spent_on: "2026-08-15", amount: 100, category: "SUPPLIES", ...over };
}

describe("computeExpenseSummary", () => {
  it("splits today, this month and this year", () => {
    const rows = [
      expense({ spent_on: "2026-08-15", amount: 200 }),
      expense({ spent_on: "2026-08-02", amount: 300 }),
      expense({ spent_on: "2026-03-10", amount: 500 }),
      expense({ spent_on: "2025-12-01", amount: 900 }),
    ];
    const s = computeExpenseSummary(rows, NOW);
    expect(s.today).toBe(200);
    expect(s.month).toBe(500);
    expect(s.year).toBe(1000);
  });

  it("reads a date-only value as local, not UTC", () => {
    // "2026-08-01" via `new Date()` is UTC midnight; west of Greenwich that is
    // 31 July, which would move the expense into the previous month.
    const s = computeExpenseSummary([expense({ spent_on: "2026-08-01", amount: 50 })], NOW);
    expect(s.month).toBe(50);
  });

  it("groups this month by category, biggest first", () => {
    const rows = [
      expense({ amount: 100, category: "SUPPLIES" }),
      expense({ amount: 900, category: "RENT" }),
      expense({ amount: 250, category: "UTILITY" }),
      expense({ amount: 50, category: "SUPPLIES" }),
    ];
    const s = computeExpenseSummary(rows, NOW);
    expect(s.byCategory).toEqual([
      { category: "RENT", amount: 900 },
      { category: "UTILITY", amount: 250 },
      { category: "SUPPLIES", amount: 150 },
    ]);
  });

  it("returns a 12-point trend ending at the current month", () => {
    const rows = [
      expense({ spent_on: "2026-08-05", amount: 400 }),
      expense({ spent_on: "2026-07-05", amount: 100 }),
    ];
    const s = computeExpenseSummary(rows, NOW);
    expect(s.monthlyTrend).toHaveLength(12);
    expect(s.monthlyTrend[11]).toBe(400);
    expect(s.monthlyTrend[10]).toBe(100);
    expect(s.monthlyTrend[0]).toBe(0);
  });

  it("is all zeroes with no rows", () => {
    const s = computeExpenseSummary([], NOW);
    expect(s).toMatchObject({ today: 0, month: 0, year: 0, byCategory: [] });
  });
});

function serial(over: Partial<DoneSerialRow> = {}): DoneSerialRow {
  return {
    completed_at: new Date(2026, 7, 10, 12).toISOString(),
    total_amount: 1000,
    services_snapshot: [],
    payment_status: "PAID",
    chair_id: "c1",
    ...over,
  };
}

function manual(over: Partial<ManualEntryRow> = {}): ManualEntryRow {
  return {
    created_at: new Date(2026, 7, 10, 12).toISOString(),
    amount: 500,
    service_name: "Shave",
    chair_id: "c1",
    payment_status: "PAID",
    ...over,
  };
}

const FROM = new Date(2026, 7, 1);
const TO = new Date(2026, 8, 1);

describe("computeStaffEarnings", () => {
  const chairs = [
    { id: "c1", commission_pct: 40 },
    { id: "c2", commission_pct: 0 },
  ];

  it("splits collected money between staff and shop by the chair's percentage", () => {
    const [c1] = computeStaffEarnings([serial()], [], chairs, FROM, TO);
    expect(c1.collected).toBe(1000);
    expect(c1.staffShare).toBe(400);
    expect(c1.shopShare).toBe(600);
  });

  it("pays no commission on money the shop hasn't received", () => {
    // A haircut taken on credit: the shop is owed, so it isn't financing the
    // barber's cut out of its own pocket yet.
    const [c1] = computeStaffEarnings(
      [serial({ payment_status: "DUE" })],
      [],
      chairs,
      FROM,
      TO,
    );
    expect(c1.collected).toBe(0);
    expect(c1.staffShare).toBe(0);
    expect(c1.pending).toBe(1000);
    expect(c1.pendingShare).toBe(400);
  });

  it("counts manual entries as the same staff member's work", () => {
    const [c1] = computeStaffEarnings([serial()], [manual()], chairs, FROM, TO);
    expect(c1.jobs).toBe(2);
    expect(c1.collected).toBe(1500);
    expect(c1.staffShare).toBe(600);
  });

  it("gives a salaried chair the whole amount as the shop's", () => {
    const rows = [serial({ chair_id: "c2", total_amount: 700 })];
    const c2 = computeStaffEarnings(rows, [], chairs, FROM, TO).find((s) => s.chairId === "c2")!;
    expect(c2.staffShare).toBe(0);
    expect(c2.shopShare).toBe(700);
  });

  it("ignores work outside the window", () => {
    const rows = [serial({ completed_at: new Date(2026, 6, 20).toISOString() })];
    const [c1] = computeStaffEarnings(rows, [], chairs, FROM, TO);
    expect(c1.jobs).toBe(0);
    expect(c1.collected).toBe(0);
  });

  it("lists every chair, including ones with no work yet", () => {
    const all = computeStaffEarnings([], [], chairs, FROM, TO);
    expect(all).toHaveLength(2);
    expect(all.every((s) => s.jobs === 0)).toBe(true);
  });

  it("drops rows with no chair rather than crediting anyone", () => {
    const rows = [serial({ chair_id: null })];
    const total = computeStaffEarnings(rows, [], chairs, FROM, TO).reduce(
      (sum, s) => sum + s.collected,
      0,
    );
    expect(total).toBe(0);
  });

  it("ranks by total business brought in, collected or not", () => {
    const rows = [
      serial({ chair_id: "c1", total_amount: 100 }),
      serial({ chair_id: "c2", total_amount: 900 }),
    ];
    const ranked = computeStaffEarnings(rows, [], chairs, FROM, TO);
    expect(ranked[0].chairId).toBe("c2");
  });
});
