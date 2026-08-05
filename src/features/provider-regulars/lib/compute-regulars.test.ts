import { describe, expect, it } from "vitest";
import { computeRegulars, type VisitRow } from "./compute-regulars";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function row(overrides: Partial<VisitRow>): VisitRow {
  return {
    customer_id: "c1",
    customer_name: "Rahim",
    customer_phone: "01700000001",
    customer_avatar_url: null,
    completed_at: NOW.toISOString(),
    status: "DONE",
    ...overrides,
  };
}

describe("computeRegulars", () => {
  it("returns an empty array for no rows", () => {
    expect(computeRegulars([], NOW)).toEqual([]);
  });

  it("ignores rows that aren't DONE", () => {
    const rows = [
      row({ status: "WAITING" }),
      row({ status: "CANCELLED" }),
      row({ status: "NO_SHOW" }),
    ];
    expect(computeRegulars(rows, NOW)).toEqual([]);
  });

  it("ignores DONE rows with no completed_at", () => {
    const rows = [row({ status: "DONE", completed_at: null })];
    expect(computeRegulars(rows, NOW)).toEqual([]);
  });

  it("drops customers below the regular-visit threshold", () => {
    const rows = [row({ customer_id: "c1" })];
    expect(computeRegulars(rows, NOW)).toEqual([]);
  });

  it("counts a customer with 2+ DONE visits as a regular", () => {
    const rows = [
      row({ customer_id: "c1", completed_at: "2026-07-01T12:00:00.000Z" }),
      row({ customer_id: "c1", completed_at: "2026-07-15T12:00:00.000Z" }),
    ];
    const regulars = computeRegulars(rows, NOW);
    expect(regulars).toHaveLength(1);
    expect(regulars[0].visitCount).toBe(2);
  });

  it("falls back to a phone-derived key when customer_id is null", () => {
    const rows = [
      row({ customer_id: null, customer_phone: "01700000009", completed_at: "2026-07-01T12:00:00.000Z" }),
      row({ customer_id: null, customer_phone: "01700000009", completed_at: "2026-07-15T12:00:00.000Z" }),
    ];
    const regulars = computeRegulars(rows, NOW);
    expect(regulars).toHaveLength(1);
    expect(regulars[0].key).toBe("phone:01700000009");
  });

  it("drops walk-ins with neither customer_id nor phone", () => {
    const rows = [
      row({ customer_id: null, customer_phone: null, completed_at: "2026-07-01T12:00:00.000Z" }),
      row({ customer_id: null, customer_phone: null, completed_at: "2026-07-15T12:00:00.000Z" }),
    ];
    expect(computeRegulars(rows, NOW)).toEqual([]);
  });

  it("marks visitedThisMonth true only when a visit falls in the current month", () => {
    const inMonth = computeRegulars(
      [
        row({ customer_id: "c1", completed_at: "2026-08-01T12:00:00.000Z" }),
        row({ customer_id: "c1", completed_at: "2026-07-01T12:00:00.000Z" }),
      ],
      NOW,
    );
    expect(inMonth[0].visitedThisMonth).toBe(true);

    const outOfMonth = computeRegulars(
      [
        row({ customer_id: "c2", completed_at: "2026-06-01T12:00:00.000Z" }),
        row({ customer_id: "c2", completed_at: "2026-07-01T12:00:00.000Z" }),
      ],
      NOW,
    );
    expect(outOfMonth[0].visitedThisMonth).toBe(false);
  });

  it("keeps the name/avatar from the most recent visit", () => {
    const rows = [
      row({ customer_id: "c1", customer_name: "Old Name", completed_at: "2026-07-01T12:00:00.000Z" }),
      row({ customer_id: "c1", customer_name: "New Name", completed_at: "2026-07-20T12:00:00.000Z" }),
    ];
    const [regular] = computeRegulars(rows, NOW);
    expect(regular.name).toBe("New Name");
    expect(regular.lastVisitAt).toBe("2026-07-20T12:00:00.000Z");
  });

  it("falls back to a translated placeholder name when customer_name is empty", () => {
    const rows = [
      row({ customer_id: "c1", customer_name: "", completed_at: "2026-07-01T12:00:00.000Z" }),
      row({ customer_id: "c1", customer_name: "", completed_at: "2026-07-20T12:00:00.000Z" }),
    ];
    const [regular] = computeRegulars(rows, NOW);
    expect(regular.name).toBe("কাস্টমার");
  });

  it("sorts customers not visited this month ahead of those who have, most-recent-first within each group", () => {
    const rows = [
      // c1: visited this month
      row({ customer_id: "c1", completed_at: "2026-08-01T12:00:00.000Z" }),
      row({ customer_id: "c1", completed_at: "2026-08-02T12:00:00.000Z" }),
      // c2: last visited long ago, not this month
      row({ customer_id: "c2", completed_at: "2026-05-01T12:00:00.000Z" }),
      row({ customer_id: "c2", completed_at: "2026-05-10T12:00:00.000Z" }),
      // c3: also not this month, but more recent than c2
      row({ customer_id: "c3", completed_at: "2026-06-01T12:00:00.000Z" }),
      row({ customer_id: "c3", completed_at: "2026-06-10T12:00:00.000Z" }),
    ];
    const regulars = computeRegulars(rows, NOW);
    expect(regulars.map((r) => r.customerId)).toEqual(["c3", "c2", "c1"]);
  });
});
