import { describe, expect, it } from "vitest";
import { computeDueLedger, type DueSerialRow } from "./compute-due-ledger";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function row(overrides: Partial<DueSerialRow>): DueSerialRow {
  return {
    id: "s1",
    customer_id: "c1",
    customer_name: "Rahim",
    customer_phone: "01700000001",
    customer_avatar_url: null,
    due_amount: 100,
    completed_at: NOW.toISOString(),
    due_reminded_at: null,
    ...overrides,
  };
}

describe("computeDueLedger", () => {
  it("returns an empty array for no rows", () => {
    expect(computeDueLedger([], NOW)).toEqual([]);
  });

  it("groups multiple due rows for the same customer into one entry", () => {
    const rows = [
      row({ id: "s1", customer_id: "c1", due_amount: 100 }),
      row({ id: "s2", customer_id: "c1", due_amount: 60 }),
    ];
    const groups = computeDueLedger(rows, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].totalDue).toBe(160);
    expect(groups[0].serialIds).toEqual(["s1", "s2"]);
  });

  it("falls back to a phone-derived key when customer_id is null", () => {
    const rows = [
      row({ id: "s1", customer_id: null, customer_phone: "01700000009", due_amount: 50 }),
      row({ id: "s2", customer_id: null, customer_phone: "01700000009", due_amount: 25 }),
    ];
    const groups = computeDueLedger(rows, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("phone:01700000009");
    expect(groups[0].totalDue).toBe(75);
  });

  it("treats rows with neither customer_id nor phone as separate, un-groupable entries", () => {
    const rows = [
      row({ id: "s1", customer_id: null, customer_phone: null, due_amount: 50 }),
      row({ id: "s2", customer_id: null, customer_phone: null, due_amount: 25 }),
    ];
    const groups = computeDueLedger(rows, NOW);
    expect(groups).toHaveLength(2);
  });

  it("tracks the oldest completed_at as oldestDueAt", () => {
    const rows = [
      row({ id: "s1", customer_id: "c1", completed_at: "2026-08-03T12:00:00.000Z" }),
      row({ id: "s2", customer_id: "c1", completed_at: "2026-08-01T12:00:00.000Z" }),
      row({ id: "s3", customer_id: "c1", completed_at: "2026-08-04T12:00:00.000Z" }),
    ];
    const [group] = computeDueLedger(rows, NOW);
    expect(group.oldestDueAt).toBe("2026-08-01T12:00:00.000Z");
  });

  it("sorts groups oldest-due-first", () => {
    const rows = [
      row({ id: "s1", customer_id: "c1", completed_at: "2026-08-04T12:00:00.000Z" }),
      row({ id: "s2", customer_id: "c2", completed_at: "2026-08-01T12:00:00.000Z" }),
    ];
    const groups = computeDueLedger(rows, NOW);
    expect(groups.map((g) => g.customerId)).toEqual(["c2", "c1"]);
  });

  it("a due row with no known customer_id is never remindable", () => {
    const rows = [row({ id: "s1", customer_id: null, customer_phone: "01700000009" })];
    const [group] = computeDueLedger(rows, NOW);
    expect(group.remindableSerialIds).toEqual([]);
  });

  it("a due row never reminded is remindable", () => {
    const rows = [row({ id: "s1", customer_id: "c1", due_reminded_at: null })];
    const [group] = computeDueLedger(rows, NOW);
    expect(group.remindableSerialIds).toEqual(["s1"]);
  });

  it("a due row reminded within the cooldown window is not remindable", () => {
    const rows = [
      row({ id: "s1", customer_id: "c1", due_reminded_at: "2026-08-05T06:00:00.000Z" }), // 6h ago
    ];
    const [group] = computeDueLedger(rows, NOW);
    expect(group.remindableSerialIds).toEqual([]);
  });

  it("a due row reminded outside the cooldown window is remindable again", () => {
    const rows = [
      row({ id: "s1", customer_id: "c1", due_reminded_at: "2026-08-03T12:00:00.000Z" }), // 2 days ago
    ];
    const [group] = computeDueLedger(rows, NOW);
    expect(group.remindableSerialIds).toEqual(["s1"]);
  });
});
