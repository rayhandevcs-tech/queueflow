import { describe, expect, it } from "vitest";
import type { LoyaltyTransaction, LoyaltyTransactionKind } from "@/types";
import {
  DEFAULT_TAKA_PER_POINT,
  balanceMatchesLedger,
  effectiveRate,
  isEarnKind,
  isLoyaltyLive,
  ledgerSum,
  lifetimeEarnedFromLedger,
  pointsForBill,
  previewEarn,
  sortLedger,
  summarize,
  takaToNextPoint,
  type SettingsLike,
} from "./loyalty";

function settings(overrides: Partial<SettingsLike> = {}): SettingsLike {
  return { is_enabled: true, taka_per_point: 100, min_bill_taka: 0, ...overrides };
}

function tx(overrides: Partial<LoyaltyTransaction> = {}): LoyaltyTransaction {
  return {
    id: "t1",
    shop_id: "shop-a",
    customer_id: "cust-1",
    points: 8,
    kind: "EARN_APPOINTMENT",
    source_serial_id: null,
    source_appointment_id: "appt-1",
    bill_amount: 800,
    taka_per_point: 100,
    note: null,
    created_by: "owner-1",
    created_at: "2026-09-15T10:00:00.000Z",
    ...overrides,
  } as LoyaltyTransaction;
}

describe("pointsForBill", () => {
  it("gives one point per completed unit of the rate", () => {
    expect(pointsForBill(800, 100)).toBe(8);
    expect(pointsForBill(1250, 100)).toBe(12);
  });

  it("floors rather than rounds — a shop never gives away a point it didn't offer", () => {
    expect(pointsForBill(850, 100)).toBe(8);
    expect(pointsForBill(199, 100)).toBe(1);
    expect(pointsForBill(99, 100)).toBe(0);
  });

  it("earns nothing below the shop's floor", () => {
    expect(pointsForBill(400, 100, 500)).toBe(0);
    expect(pointsForBill(500, 100, 500)).toBe(5);
    expect(pointsForBill(501, 100, 500)).toBe(5);
  });

  it("treats a zero bill as zero points", () => {
    expect(pointsForBill(0, 100)).toBe(0);
  });

  it("returns 0 for a degenerate rate rather than dividing by zero or going infinite", () => {
    expect(pointsForBill(800, 0)).toBe(0);
    expect(pointsForBill(800, -100)).toBe(0);
  });

  it("returns 0 for missing or non-finite input instead of NaN", () => {
    expect(pointsForBill(null, 100)).toBe(0);
    expect(pointsForBill(800, null)).toBe(0);
    expect(pointsForBill(undefined, undefined)).toBe(0);
    expect(pointsForBill(Number.NaN, 100)).toBe(0);
    expect(pointsForBill(Number.POSITIVE_INFINITY, 100)).toBe(0);
  });

  it("handles a rate of 1 — a point per taka", () => {
    expect(pointsForBill(800, 1)).toBe(800);
  });

  it("never returns a negative number, even for a negative bill", () => {
    expect(pointsForBill(-500, 100)).toBe(0);
  });

  it("matches the SQL mirror on the cases the harness checks", () => {
    // These exact rows are asserted against points_for_bill() in
    // supabase/tests/run-sprint7-checks.sh — if one side changes, both fail.
    const cases: [number, number, number, number][] = [
      [800, 100, 0, 8],
      [99, 100, 0, 0],
      [850, 100, 0, 8],
      [0, 100, 0, 0],
      [400, 100, 500, 0],
      [500, 100, 500, 5],
      [800, 0, 0, 0],
      [800, 1, 0, 800],
    ];
    for (const [bill, rate, floor, expected] of cases) {
      expect(pointsForBill(bill, rate, floor)).toBe(expected);
    }
  });
});

describe("the on/off switch (decision 36)", () => {
  it("is off for a shop with no settings row at all", () => {
    expect(isLoyaltyLive(null)).toBe(false);
    expect(isLoyaltyLive(undefined)).toBe(false);
  });

  it("is off for a row that exists but is disabled", () => {
    expect(isLoyaltyLive(settings({ is_enabled: false }))).toBe(false);
  });

  it("is on only when the owner switched it on", () => {
    expect(isLoyaltyLive(settings())).toBe(true);
  });

  it("falls back to the default rate when there is no row or a broken one", () => {
    expect(effectiveRate(null)).toBe(DEFAULT_TAKA_PER_POINT);
    expect(effectiveRate(settings({ taka_per_point: 0 }))).toBe(DEFAULT_TAKA_PER_POINT);
    expect(effectiveRate(settings({ taka_per_point: 250 }))).toBe(250);
  });
});

describe("previewEarn", () => {
  it("works the owner's own rate through a sample bill", () => {
    expect(previewEarn(100, 0, 800)).toEqual({ bill: 800, points: 8, belowFloor: false });
  });

  it("flags a sample that the shop's own floor would reject", () => {
    expect(previewEarn(100, 1000, 800)).toEqual({ bill: 800, points: 0, belowFloor: true });
  });
});

describe("takaToNextPoint", () => {
  it("is a full rate away when nothing has been spent", () => {
    expect(takaToNextPoint(settings(), 0)).toBe(100);
  });

  it("counts down inside the current unit", () => {
    expect(takaToNextPoint(settings(), 40)).toBe(60);
    expect(takaToNextPoint(settings(), 99)).toBe(1);
  });

  it("resets to a full rate exactly on a boundary", () => {
    expect(takaToNextPoint(settings(), 100)).toBe(100);
    expect(takaToNextPoint(settings(), 800)).toBe(100);
  });

  it("reports the floor, not the rate, when the floor is what's in the way", () => {
    expect(takaToNextPoint(settings({ min_bill_taka: 500 }), 200)).toBe(300);
  });

  it("uses the default rate for a shop with no row", () => {
    expect(takaToNextPoint(null, 0)).toBe(DEFAULT_TAKA_PER_POINT);
  });
});

describe("balance == ledger sum (the plan's invariant)", () => {
  it("sums an empty ledger to zero", () => {
    expect(ledgerSum([])).toBe(0);
    expect(balanceMatchesLedger(0, [])).toBe(true);
  });

  it("sums earns and corrections together", () => {
    const rows = [tx({ points: 8 }), tx({ points: 12 }), tx({ points: -3, kind: "ADJUST" })];
    expect(ledgerSum(rows)).toBe(17);
    expect(balanceMatchesLedger(17, rows)).toBe(true);
  });

  it("catches a balance that has drifted from its ledger", () => {
    const rows = [tx({ points: 8 })];
    expect(balanceMatchesLedger(9, rows)).toBe(false);
    expect(balanceMatchesLedger(0, rows)).toBe(false);
  });

  it("counts only the positive rows toward lifetime earned", () => {
    // A correction that removes points does not un-earn what came before it.
    const rows = [tx({ points: 8 }), tx({ points: 5, kind: "ADJUST" }), tx({ points: -3, kind: "ADJUST" })];
    expect(ledgerSum(rows)).toBe(10);
    expect(lifetimeEarnedFromLedger(rows)).toBe(13);
  });

  it("lifetime earned never falls below the balance when nothing was spent", () => {
    const rows = [tx({ points: 8 }), tx({ points: 12 })];
    expect(lifetimeEarnedFromLedger(rows)).toBe(ledgerSum(rows));
  });
});

describe("kinds", () => {
  it("names the earning kinds and excludes corrections", () => {
    // The two referral kinds joined this list in Sprint 8: a referral bonus
    // is earned, not corrected by hand.
    const earn: LoyaltyTransactionKind[] = [
      "EARN_SERIAL",
      "EARN_APPOINTMENT",
      "REFERRAL_REFERRER",
      "REFERRAL_REFERRED",
    ];
    expect(earn.every(isEarnKind)).toBe(true);
    expect(isEarnKind("ADJUST")).toBe(false);
    // REDEEM arrived in Sprint 9 and is deliberately NOT an earning kind:
    // spending points is the opposite of earning them.
    expect(isEarnKind("REDEEM")).toBe(false);
  });
});

describe("sortLedger", () => {
  it("puts the newest row first", () => {
    const rows = [
      tx({ id: "old", created_at: "2026-09-01T10:00:00.000Z" }),
      tx({ id: "new", created_at: "2026-09-15T10:00:00.000Z" }),
    ];
    expect(sortLedger(rows).map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("reads an award before the correction that followed it in the same second", () => {
    const rows = [
      tx({ id: "correction", points: -3, kind: "ADJUST", created_at: "2026-09-15T10:00:00.000Z" }),
      tx({ id: "award", points: 8, created_at: "2026-09-15T10:00:00.000Z" }),
    ];
    expect(sortLedger(rows).map((r) => r.id)).toEqual(["award", "correction"]);
  });

  it("does not mutate the list it was given", () => {
    const rows = [
      tx({ id: "a", created_at: "2026-09-01T10:00:00.000Z" }),
      tx({ id: "b", created_at: "2026-09-15T10:00:00.000Z" }),
    ];
    sortLedger(rows);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("summarize", () => {
  it("is all zeros for a programme nobody has joined", () => {
    expect(summarize([])).toEqual({
      memberCount: 0,
      outstandingPoints: 0,
      lifetimePoints: 0,
      topBalance: 0,
    });
  });

  it("counts only customers holding points as members", () => {
    const accounts = [
      { balance: 10, lifetime_earned: 10 },
      { balance: 0, lifetime_earned: 25 },
      { balance: 4, lifetime_earned: 4 },
    ];
    expect(summarize(accounts).memberCount).toBe(2);
  });

  it("totals what the shop owes and what it has ever given", () => {
    const accounts = [
      { balance: 10, lifetime_earned: 30 },
      { balance: 4, lifetime_earned: 4 },
    ];
    const summary = summarize(accounts);
    expect(summary.outstandingPoints).toBe(14);
    expect(summary.lifetimePoints).toBe(34);
    expect(summary.topBalance).toBe(10);
  });

  it("keeps outstanding and lifetime apart — spending lowers one, not the other", () => {
    const summary = summarize([{ balance: 2, lifetime_earned: 40 }]);
    expect(summary.outstandingPoints).toBe(2);
    expect(summary.lifetimePoints).toBe(40);
  });
});
