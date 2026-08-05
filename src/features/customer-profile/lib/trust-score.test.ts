import { describe, expect, it } from "vitest";
import { computeTrustSummary, type HistorySerialRow } from "./trust-score";

function row(overrides: Partial<HistorySerialRow>): HistorySerialRow {
  return {
    shop_id: "shop1",
    status: "DONE",
    ...overrides,
  };
}

describe("computeTrustSummary", () => {
  it("returns a null score with zero counts for no history", () => {
    expect(computeTrustSummary([])).toEqual({
      visitCount: 0,
      noShowCount: 0,
      regularShopCount: 0,
      score: null,
    });
  });

  it("counts DONE rows as visits and NO_SHOW rows as no-shows", () => {
    const rows = [row({ status: "DONE" }), row({ status: "DONE" }), row({ status: "NO_SHOW" })];
    const summary = computeTrustSummary(rows);
    expect(summary.visitCount).toBe(2);
    expect(summary.noShowCount).toBe(1);
  });

  it("ignores rows with other statuses (WAITING, IN_PROGRESS, CANCELLED)", () => {
    const rows = [row({ status: "WAITING" }), row({ status: "IN_PROGRESS" }), row({ status: "CANCELLED" })];
    const summary = computeTrustSummary(rows);
    expect(summary.visitCount).toBe(0);
    expect(summary.noShowCount).toBe(0);
    expect(summary.score).toBeNull();
  });

  it("counts a shop as regular once it has 2+ DONE visits", () => {
    const rows = [
      row({ shop_id: "shop1", status: "DONE" }),
      row({ shop_id: "shop1", status: "DONE" }),
      row({ shop_id: "shop2", status: "DONE" }),
    ];
    const summary = computeTrustSummary(rows);
    expect(summary.regularShopCount).toBe(1);
  });

  it("scores a perfect attendance record as 5", () => {
    const rows = [row({ status: "DONE" }), row({ status: "DONE" })];
    expect(computeTrustSummary(rows).score).toBe(5);
  });

  it("scores a customer with one no-show out of two visits as 3.3", () => {
    const rows = [row({ status: "DONE" }), row({ status: "DONE" }), row({ status: "NO_SHOW" })];
    expect(computeTrustSummary(rows).score).toBe(3.3); // (2/3)*5 rounded to 1 decimal
  });

  it("scores an all-no-show record as 0", () => {
    const rows = [row({ status: "NO_SHOW" })];
    expect(computeTrustSummary(rows).score).toBe(0);
  });
});
