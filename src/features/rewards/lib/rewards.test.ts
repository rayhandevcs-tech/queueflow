import { describe, expect, it } from "vitest";
import {
  DISCOUNT_PCT_MAX,
  POINTS_COST_MAX,
  POINTS_COST_MIN,
  REDEMPTION_STATUSES,
  REWARD_KINDS,
  billAfter,
  canRedeem,
  discountFor,
  isCodeShaped,
  isDiscountKind,
  isRewardAvailable,
  isUsable,
  normalizeCode,
  pointsShort,
  redemptionState,
  sortRewards,
  summarizeCatalogue,
  type RedemptionLike,
  type RewardLike,
  type SnapshotService,
} from "./rewards";

const NOW = new Date("2026-09-15T10:00:00.000Z");
const YESTERDAY = "2026-09-14T10:00:00.000Z";
const TOMORROW = "2026-09-16T10:00:00.000Z";

function reward(overrides: Partial<RewardLike> = {}): RewardLike {
  return {
    kind: "DISCOUNT_FLAT",
    value: 100,
    service_id: null,
    points_cost: 50,
    is_active: true,
    stock: null,
    valid_until: null,
    ...overrides,
  };
}

const FACIAL = "service-facial";
const MEHENDI = "service-mehendi";
const SNAPSHOT: SnapshotService[] = [
  { service_id: FACIAL, name: "Facial", rate: 800 },
  { service_id: MEHENDI, name: "Mehendi", rate: 1500 },
];

// ---------------------------------------------------------------------------
// the discount — a mirror of reward_discount_for()
// ---------------------------------------------------------------------------

describe("discountFor", () => {
  it("takes a flat amount off", () => {
    expect(discountFor(reward(), 800)).toBe(100);
  });

  it("**never gives back more than the bill**", () => {
    // A ৳500 reward on a ৳300 bill is ৳300 off, not a ৳200 refund.
    expect(discountFor(reward({ value: 500 }), 300)).toBe(300);
  });

  it("takes a percentage off, to two places", () => {
    expect(discountFor(reward({ kind: "DISCOUNT_PCT", value: 10 }), 850)).toBe(85);
    expect(discountFor(reward({ kind: "DISCOUNT_PCT", value: 10 }), 855)).toBe(85.5);
  });

  it("a 100% reward is the whole bill and no more", () => {
    expect(discountFor(reward({ kind: "DISCOUNT_PCT", value: 100 }), 800)).toBe(800);
  });

  it("clamps a nonsense percentage rather than overshooting", () => {
    expect(discountFor(reward({ kind: "DISCOUNT_PCT", value: 250 }), 800)).toBe(800);
    expect(discountFor(reward({ kind: "DISCOUNT_PCT", value: -5 }), 800)).toBe(0);
  });

  it("a free service is worth the rate the customer was quoted", () => {
    const free = reward({ kind: "FREE_SERVICE", value: null, service_id: FACIAL });
    expect(discountFor(free, 2300, SNAPSHOT)).toBe(800);
  });

  it("a free service that is not in the bill is worth nothing", () => {
    const free = reward({ kind: "FREE_SERVICE", value: null, service_id: "service-nail" });
    expect(discountFor(free, 2300, SNAPSHOT)).toBe(0);
  });

  it("a free service never exceeds the bill either", () => {
    const free = reward({ kind: "FREE_SERVICE", value: null, service_id: MEHENDI });
    expect(discountFor(free, 900, SNAPSHOT)).toBe(900);
  });

  it("returns 0 for every degenerate bill rather than throwing", () => {
    expect(discountFor(reward(), 0)).toBe(0);
    expect(discountFor(reward(), null)).toBe(0);
    expect(discountFor(reward(), undefined)).toBe(0);
    expect(discountFor(reward(), -100)).toBe(0);
    expect(discountFor(reward(), Number.NaN)).toBe(0);
  });

  it("does not leave float dust behind", () => {
    // 0.07 * 1000 / 100 is 0.7000000000000001 in binary floating point.
    expect(discountFor(reward({ kind: "DISCOUNT_PCT", value: 7 }), 1010)).toBe(70.7);
  });
});

describe("billAfter", () => {
  it("subtracts, and never goes below zero", () => {
    expect(billAfter(800, 100)).toBe(700);
    expect(billAfter(300, 500)).toBe(0);
    expect(billAfter(800, 0)).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// availability
// ---------------------------------------------------------------------------

describe("isRewardAvailable", () => {
  it("is available when active, in date and in stock", () => {
    expect(isRewardAvailable(reward(), NOW)).toBe(true);
    expect(isRewardAvailable(reward({ stock: 3, valid_until: TOMORROW }), NOW)).toBe(true);
  });

  it("is not available when switched off", () => {
    expect(isRewardAvailable(reward({ is_active: false }), NOW)).toBe(false);
  });

  it("is not available past its valid_until", () => {
    expect(isRewardAvailable(reward({ valid_until: YESTERDAY }), NOW)).toBe(false);
  });

  it("is not available out of stock — but unlimited stock is null, not 0", () => {
    expect(isRewardAvailable(reward({ stock: 0 }), NOW)).toBe(false);
    expect(isRewardAvailable(reward({ stock: null }), NOW)).toBe(true);
  });

  it("a missing reward is not available", () => {
    expect(isRewardAvailable(null, NOW)).toBe(false);
    expect(isRewardAvailable(undefined, NOW)).toBe(false);
  });
});

describe("canRedeem", () => {
  it("says yes with enough points", () => {
    expect(canRedeem(reward(), 50, NOW)).toEqual({ ok: true, block: null });
    expect(canRedeem(reward(), 500, NOW)).toEqual({ ok: true, block: null });
  });

  it("**names the reason that is actually true, in the server's own order**", () => {
    // A switched-off reward is not "too expensive"; an out-of-stock one is
    // not "expired". Telling the customer the wrong reason sends them to fix
    // the wrong thing.
    expect(canRedeem(reward({ is_active: false }), 0, NOW).block).toBe("INACTIVE");
    expect(canRedeem(reward({ valid_until: YESTERDAY }), 0, NOW).block).toBe("OFFER_EXPIRED");
    expect(canRedeem(reward({ stock: 0 }), 0, NOW).block).toBe("OUT_OF_STOCK");
    expect(canRedeem(reward(), 49, NOW).block).toBe("NOT_ENOUGH_POINTS");
  });

  it("an exact balance is enough", () => {
    expect(canRedeem(reward({ points_cost: 50 }), 50, NOW).ok).toBe(true);
    expect(canRedeem(reward({ points_cost: 51 }), 50, NOW).ok).toBe(false);
  });

  it("a null or absent balance buys nothing", () => {
    expect(canRedeem(reward(), null, NOW).block).toBe("NOT_ENOUGH_POINTS");
    expect(canRedeem(reward(), undefined, NOW).block).toBe("NOT_ENOUGH_POINTS");
  });

  it("a missing reward cannot be redeemed", () => {
    expect(canRedeem(null, 9999, NOW).ok).toBe(false);
  });
});

describe("pointsShort", () => {
  it("turns a dead end into a distance", () => {
    expect(pointsShort(reward({ points_cost: 80 }), 50)).toBe(30);
  });

  it("is 0 once they can afford it", () => {
    expect(pointsShort(reward({ points_cost: 50 }), 50)).toBe(0);
    expect(pointsShort(reward({ points_cost: 50 }), 500)).toBe(0);
  });

  it("counts the whole cost for someone with no account yet", () => {
    expect(pointsShort(reward({ points_cost: 50 }), null)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// a coupon in hand
// ---------------------------------------------------------------------------

function coupon(overrides: Partial<RedemptionLike> = {}): RedemptionLike {
  return { status: "ISSUED", expires_at: null, ...overrides };
}

describe("redemptionState", () => {
  it("an issued coupon with no deadline is usable", () => {
    expect(redemptionState(coupon(), NOW)).toBe("USABLE");
  });

  it("a used coupon is used", () => {
    expect(redemptionState(coupon({ status: "USED" }), NOW)).toBe("USED");
  });

  it("**computes expiry rather than trusting the column**", () => {
    // The nightly sweep sets the status, but a coupon that died an hour ago
    // is already dead and the screen must not offer it.
    expect(redemptionState(coupon({ expires_at: YESTERDAY }), NOW)).toBe("EXPIRED");
    expect(redemptionState(coupon({ status: "EXPIRED" }), NOW)).toBe("EXPIRED");
  });

  it("a deadline still ahead does not expire it", () => {
    expect(redemptionState(coupon({ expires_at: TOMORROW }), NOW)).toBe("USABLE");
  });

  it("used beats expired — what happened, happened", () => {
    expect(redemptionState(coupon({ status: "USED", expires_at: YESTERDAY }), NOW)).toBe("USED");
  });

  it("isUsable agrees with it", () => {
    expect(isUsable(coupon(), NOW)).toBe(true);
    expect(isUsable(coupon({ status: "USED" }), NOW)).toBe(false);
    expect(isUsable(coupon({ expires_at: YESTERDAY }), NOW)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// the code
// ---------------------------------------------------------------------------

describe("normalizeCode / isCodeShaped", () => {
  it("upper-cases and trims, matching the RPC", () => {
    expect(normalizeCode("  ab7k2m ")).toBe("AB7K2M");
    expect(normalizeCode(null)).toBe("");
  });

  it("accepts what the database would accept", () => {
    expect(isCodeShaped("AB7K2M")).toBe(true);
    expect(isCodeShaped(" ab7k2m ")).toBe(true);
  });

  it("refuses the wrong length, punctuation and emptiness", () => {
    expect(isCodeShaped("AB7K2")).toBe(false);
    expect(isCodeShaped("AB7K2MAB7K2MA")).toBe(false);
    expect(isCodeShaped("AB7-K2")).toBe(false);
    expect(isCodeShaped("")).toBe(false);
    expect(isCodeShaped("      ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// lists and totals
// ---------------------------------------------------------------------------

function listed(overrides: Partial<RewardLike> & { name: string; sort_order: number }) {
  return { ...reward(), ...overrides };
}

describe("sortRewards", () => {
  it("honours the owner's own arrangement first", () => {
    const rows = sortRewards([
      listed({ name: "B", sort_order: 2 }),
      listed({ name: "A", sort_order: 1 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["A", "B"]);
  });

  it("then the cheapest, for a customer scanning the shelf", () => {
    const rows = sortRewards([
      listed({ name: "Pricey", sort_order: 0, points_cost: 200 }),
      listed({ name: "Cheap", sort_order: 0, points_cost: 20 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Cheap", "Pricey"]);
  });

  it("then the name, so the order is stable rather than arbitrary", () => {
    const rows = sortRewards([
      listed({ name: "Zebra", sort_order: 0, points_cost: 50 }),
      listed({ name: "Apple", sort_order: 0, points_cost: 50 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Apple", "Zebra"]);
  });

  it("does not mutate the caller's array", () => {
    const input = [
      listed({ name: "B", sort_order: 2 }),
      listed({ name: "A", sort_order: 1 }),
    ];
    sortRewards(input);
    expect(input[0].name).toBe("B");
  });
});

describe("summarizeCatalogue", () => {
  it("counts an empty catalogue without dividing by anything", () => {
    expect(summarizeCatalogue([], NOW)).toEqual({ total: 0, available: 0, cheapest: 0 });
  });

  it("separates what exists from what is on the shelf", () => {
    const summary = summarizeCatalogue(
      [
        reward({ points_cost: 50 }),
        reward({ points_cost: 30 }),
        reward({ is_active: false, points_cost: 10 }),
        reward({ stock: 0, points_cost: 5 }),
        reward({ valid_until: YESTERDAY, points_cost: 1 }),
      ],
      NOW,
    );
    expect(summary).toEqual({ total: 5, available: 2, cheapest: 30 });
  });

  it("an all-unavailable catalogue has no cheapest price to quote", () => {
    expect(summarizeCatalogue([reward({ is_active: false })], NOW)).toEqual({
      total: 1,
      available: 0,
      cheapest: 0,
    });
  });
});

describe("the shapes the plan fixed", () => {
  it("has exactly the three reward kinds, no more", () => {
    expect(REWARD_KINDS).toEqual(["DISCOUNT_FLAT", "DISCOUNT_PCT", "FREE_SERVICE"]);
  });

  it("has three redemption statuses — there is no CANCELLED", () => {
    expect(REDEMPTION_STATUSES).toEqual(["ISSUED", "USED", "EXPIRED"]);
    expect(REDEMPTION_STATUSES).not.toContain("CANCELLED");
  });

  it("names the two kinds that reduce a bill by a chosen number", () => {
    expect(isDiscountKind("DISCOUNT_FLAT")).toBe(true);
    expect(isDiscountKind("DISCOUNT_PCT")).toBe(true);
    expect(isDiscountKind("FREE_SERVICE")).toBe(false);
  });

  it("mirrors the CHECK bounds the form has to refuse first", () => {
    expect(POINTS_COST_MIN).toBe(1);
    expect(POINTS_COST_MAX).toBe(1_000_000);
    expect(DISCOUNT_PCT_MAX).toBe(100);
  });
});
