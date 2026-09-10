import { describe, expect, it } from "vitest";
import type { CustomerMembership, MembershipStatus, MembershipTier } from "@/types";
import { parseBenefits, parseTierSnapshot } from "@/types";
import {
  canTransition,
  daysLeft,
  effectiveStatus,
  expiryFrom,
  findLiveMembership,
  hasLiveMembership,
  isActiveNow,
  isExpiringSoon,
  isLiveStatus,
  isTerminal,
  nextStatuses,
  soldAs,
  sortMembershipsForOwner,
  sortTiers,
} from "./membership";
import { TIER_PRESETS } from "./presets";

const NOW = new Date("2026-09-10T12:00:00.000Z");
const DAY = 86_400_000;

function at(offsetDays: number): string {
  return new Date(NOW.getTime() + offsetDays * DAY).toISOString();
}

function membership(overrides: Partial<CustomerMembership> = {}): CustomerMembership {
  return {
    id: "m1",
    shop_id: "shop-a",
    customer_id: "cust-1",
    tier_id: "tier-gold",
    status: "ACTIVE",
    customer_name: "Rumi",
    customer_phone: "01900000003",
    customer_avatar_url: null,
    tier_snapshot: {
      tier_id: "tier-gold",
      name: "Gold",
      description: "The popular one",
      price: 1500,
      duration_days: 180,
      benefits: [{ kind: "DISCOUNT", label: "১০% ছাড়", value: 10 }],
    },
    price: 1500,
    duration_days: 180,
    payment_status: "PAID",
    payment_method: "bkash",
    paid_at: at(-1),
    started_at: at(-10),
    expires_at: at(170),
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    note: null,
    created_at: at(-10),
    updated_at: at(-10),
    ...overrides,
  } as CustomerMembership;
}

function tier(overrides: Partial<MembershipTier> = {}): MembershipTier {
  return {
    id: "t1",
    shop_id: "shop-a",
    name: "Gold",
    description: null,
    price: 1500,
    duration_days: 180,
    benefits: [],
    is_active: true,
    sort_order: 0,
    created_at: at(-30),
    updated_at: at(-30),
    ...overrides,
  } as MembershipTier;
}

describe("the status machine", () => {
  it("mirrors the DB: PENDING can be activated or cancelled", () => {
    expect(nextStatuses("PENDING")).toEqual(["ACTIVE", "CANCELLED"]);
  });

  it("ACTIVE can only expire or be cancelled", () => {
    expect(nextStatuses("ACTIVE")).toEqual(["EXPIRED", "CANCELLED"]);
  });

  it("never allows going back to PENDING", () => {
    expect(canTransition("ACTIVE", "PENDING")).toBe(false);
    expect(canTransition("EXPIRED", "PENDING")).toBe(false);
  });

  it("never revives a finished membership — renewal is a new row", () => {
    expect(canTransition("EXPIRED", "ACTIVE")).toBe(false);
    expect(canTransition("CANCELLED", "ACTIVE")).toBe(false);
  });

  it("treats EXPIRED and CANCELLED as terminal, the other two as not", () => {
    expect(isTerminal("EXPIRED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("PENDING")).toBe(false);
    expect(isTerminal("ACTIVE")).toBe(false);
  });

  it("counts PENDING and ACTIVE as occupying the customer's one slot", () => {
    // The same pair the partial unique index is built on.
    const live: MembershipStatus[] = ["PENDING", "ACTIVE"];
    const dead: MembershipStatus[] = ["EXPIRED", "CANCELLED"];
    expect(live.every(isLiveStatus)).toBe(true);
    expect(dead.some(isLiveStatus)).toBe(false);
  });
});

describe("expiry", () => {
  it("reads an in-term membership as active", () => {
    expect(effectiveStatus(membership(), NOW)).toBe("ACTIVE");
    expect(isActiveNow(membership(), NOW)).toBe(true);
  });

  it("reads a lapsed row as EXPIRED even while the DB still says ACTIVE", () => {
    // This is the whole reason the cron is tidy-up rather than correctness.
    const lapsed = membership({ status: "ACTIVE", expires_at: at(-1) });
    expect(lapsed.status).toBe("ACTIVE");
    expect(effectiveStatus(lapsed, NOW)).toBe("EXPIRED");
    expect(isActiveNow(lapsed, NOW)).toBe(false);
  });

  it("treats the exact expiry instant as over, matching the SQL's `<=`", () => {
    const exactly = membership({ expires_at: NOW.toISOString() });
    expect(isActiveNow(exactly, NOW)).toBe(false);
  });

  it("leaves a non-ACTIVE status alone", () => {
    expect(effectiveStatus(membership({ status: "PENDING", expires_at: null }), NOW)).toBe("PENDING");
    expect(effectiveStatus(membership({ status: "CANCELLED", expires_at: at(90) }), NOW)).toBe("CANCELLED");
  });

  it("a PENDING request is never active", () => {
    expect(isActiveNow(membership({ status: "PENDING", expires_at: null }), NOW)).toBe(false);
  });

  it("rounds days left up, so a membership with hours left is not '0 days'", () => {
    expect(daysLeft(membership({ expires_at: at(0.25) }), NOW)).toBe(1);
    expect(daysLeft(membership({ expires_at: at(9.1) }), NOW)).toBe(10);
  });

  it("never reports negative days left", () => {
    expect(daysLeft(membership({ expires_at: at(-30) }), NOW)).toBe(0);
  });

  it("has no days left to report for a membership that never started", () => {
    expect(daysLeft(membership({ status: "PENDING", expires_at: null }), NOW)).toBeNull();
  });

  it("flags the last week as expiring soon", () => {
    expect(isExpiringSoon(membership({ expires_at: at(3) }), NOW)).toBe(true);
    expect(isExpiringSoon(membership({ expires_at: at(30) }), NOW)).toBe(false);
  });

  it("does not flag an already-lapsed or pending one as expiring soon", () => {
    expect(isExpiringSoon(membership({ expires_at: at(-1) }), NOW)).toBe(false);
    expect(isExpiringSoon(membership({ status: "PENDING", expires_at: null }), NOW)).toBe(false);
  });

  it("computes expiry the same way make_interval(days => n) does", () => {
    const start = new Date("2026-09-10T12:00:00.000Z");
    expect(expiryFrom(start, 30).toISOString()).toBe("2026-10-10T12:00:00.000Z");
    // Across a month boundary and a 31-day month, without arithmetic on ms.
    expect(expiryFrom(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString()).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });
});

describe("one live membership per business", () => {
  it("finds the live membership at the shop asked about", () => {
    const rows = [membership({ id: "a", shop_id: "shop-a" })];
    expect(findLiveMembership(rows, "shop-a", NOW)?.id).toBe("a");
  });

  it("does not let a membership at one shop count at another", () => {
    // The business-isolation rule, client side. RLS is the enforcing half.
    const rows = [membership({ id: "a", shop_id: "shop-a" })];
    expect(findLiveMembership(rows, "shop-b", NOW)).toBeNull();
    expect(hasLiveMembership(rows, "shop-b", NOW)).toBe(false);
  });

  it("lets one customer hold a membership at each of two shops", () => {
    const rows = [
      membership({ id: "a", shop_id: "shop-a" }),
      membership({ id: "b", shop_id: "shop-b" }),
    ];
    expect(findLiveMembership(rows, "shop-a", NOW)?.id).toBe("a");
    expect(findLiveMembership(rows, "shop-b", NOW)?.id).toBe("b");
  });

  it("counts a PENDING request as occupying the slot", () => {
    const rows = [membership({ status: "PENDING", expires_at: null, started_at: null })];
    expect(hasLiveMembership(rows, "shop-a", NOW)).toBe(true);
  });

  it("frees the slot once a membership is cancelled", () => {
    const rows = [membership({ status: "CANCELLED" })];
    expect(hasLiveMembership(rows, "shop-a", NOW)).toBe(false);
  });

  it("frees the slot for a lapsed row the cron has not reached yet", () => {
    // Otherwise a customer whose membership ended at midnight could not renew
    // until the nightly job had run — the exact case the insert trigger's
    // lazy expiry exists for.
    const rows = [membership({ status: "ACTIVE", expires_at: at(-0.5) })];
    expect(hasLiveMembership(rows, "shop-a", NOW)).toBe(false);
  });

  it("ignores an EXPIRED row entirely", () => {
    expect(hasLiveMembership([membership({ status: "EXPIRED" })], "shop-a", NOW)).toBe(false);
  });
});

describe("historical snapshot", () => {
  it("reports the price and name the membership was sold at", () => {
    const sold = soldAs(membership({ price: 1500 }));
    expect(sold.price).toBe(1500);
    expect(sold.name).toBe("Gold");
    expect(sold.durationDays).toBe(180);
  });

  it("keeps reporting the old price after the tier is repriced", () => {
    // The tier row is irrelevant here by construction — nothing in `soldAs`
    // can reach it, which is what makes the history safe.
    const old = membership({
      price: 1000,
      duration_days: 30,
      tier_snapshot: {
        tier_id: "tier-gold",
        name: "Gold",
        description: null,
        price: 1000,
        duration_days: 30,
        benefits: [{ kind: "DISCOUNT", label: "১০% ছাড়", value: 10 }],
      },
    });
    expect(soldAs(old).price).toBe(1000);
    expect(soldAs(old).name).toBe("Gold");
    expect(soldAs(old).benefits).toEqual([{ kind: "DISCOUNT", label: "১০% ছাড়", value: 10 }]);
  });

  it("survives a snapshot that is missing or malformed", () => {
    expect(soldAs(membership({ tier_snapshot: null })).name).toBe("");
    expect(soldAs(membership({ tier_snapshot: "nonsense" })).benefits).toEqual([]);
    // The flat columns are still authoritative for money.
    expect(soldAs(membership({ tier_snapshot: null, price: 700 })).price).toBe(700);
  });

  it("parses a well-formed snapshot", () => {
    const parsed = parseTierSnapshot(membership().tier_snapshot);
    expect(parsed?.name).toBe("Gold");
    expect(parsed?.duration_days).toBe(180);
    expect(parsed?.benefits).toHaveLength(1);
  });

  it("returns null for a snapshot with no name", () => {
    expect(parseTierSnapshot({ price: 100 })).toBeNull();
    expect(parseTierSnapshot([])).toBeNull();
    expect(parseTierSnapshot(null)).toBeNull();
  });
});

describe("parseBenefits", () => {
  it("keeps well-formed benefits", () => {
    expect(
      parseBenefits([
        { kind: "DISCOUNT", label: "১০% ছাড়", value: 10 },
        { kind: "PRIORITY_BOOKING", label: "আগে সময়" },
      ]),
    ).toEqual([
      { kind: "DISCOUNT", label: "১০% ছাড়", value: 10 },
      { kind: "PRIORITY_BOOKING", label: "আগে সময়", value: null },
    ]);
  });

  it("drops an unknown kind rather than rendering it", () => {
    expect(parseBenefits([{ kind: "FREE_CAR", label: "a car" }])).toEqual([]);
  });

  it("drops an empty label", () => {
    expect(parseBenefits([{ kind: "DISCOUNT", label: "   " }])).toEqual([]);
  });

  it("trims the label", () => {
    expect(parseBenefits([{ kind: "DISCOUNT", label: "  ছাড়  " }])[0].label).toBe("ছাড়");
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(parseBenefits(null)).toEqual([]);
    expect(parseBenefits({ kind: "DISCOUNT" })).toEqual([]);
    expect(parseBenefits("[]")).toEqual([]);
  });

  it("skips nulls and nested arrays inside the list", () => {
    expect(parseBenefits([null, [], { kind: "DISCOUNT", label: "ok" }])).toHaveLength(1);
  });
});

describe("ordering", () => {
  it("puts pending requests above everything for the owner", () => {
    const rows = [
      membership({ id: "active", status: "ACTIVE", created_at: at(-1) }),
      membership({ id: "pending", status: "PENDING", expires_at: null, created_at: at(-30) }),
      membership({ id: "ended", status: "CANCELLED", created_at: at(-2) }),
    ];
    expect(sortMembershipsForOwner(rows, NOW).map((r) => r.id)).toEqual([
      "pending",
      "active",
      "ended",
    ]);
  });

  it("orders live memberships by how soon they lapse", () => {
    const rows = [
      membership({ id: "far", expires_at: at(100) }),
      membership({ id: "soon", expires_at: at(2) }),
      membership({ id: "mid", expires_at: at(40) }),
    ];
    expect(sortMembershipsForOwner(rows, NOW).map((r) => r.id)).toEqual(["soon", "mid", "far"]);
  });

  it("sinks a lapsed row below a live one even before the cron runs", () => {
    const rows = [
      membership({ id: "lapsed", status: "ACTIVE", expires_at: at(-5) }),
      membership({ id: "live", status: "ACTIVE", expires_at: at(5) }),
    ];
    expect(sortMembershipsForOwner(rows, NOW).map((r) => r.id)).toEqual(["live", "lapsed"]);
  });

  it("does not mutate the list it was given", () => {
    const rows = [membership({ id: "a" }), membership({ id: "b", status: "PENDING", expires_at: null })];
    sortMembershipsForOwner(rows, NOW);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("orders tiers by the owner's own sort_order first", () => {
    const tiers = [
      tier({ id: "c", sort_order: 2, price: 100 }),
      tier({ id: "a", sort_order: 0, price: 9000 }),
      tier({ id: "b", sort_order: 1, price: 500 }),
    ];
    expect(sortTiers(tiers).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("falls back to price when the owner has not ordered them", () => {
    const tiers = [
      tier({ id: "expensive", sort_order: 0, price: 6000 }),
      tier({ id: "cheap", sort_order: 0, price: 500 }),
    ];
    expect(sortTiers(tiers).map((t) => t.id)).toEqual(["cheap", "expensive"]);
  });
});

describe("TIER_PRESETS", () => {
  it("is the four conventional tiers, cheapest first", () => {
    expect(TIER_PRESETS.map((p) => p.name)).toEqual(["Silver", "Gold", "Platinum", "Diamond"]);
    const prices = TIER_PRESETS.map((p) => p.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("gives every preset a benefit the SQL guard would accept", () => {
    for (const preset of TIER_PRESETS) {
      expect(preset.benefits.length).toBeGreaterThan(0);
      // The same round trip the database does: shape in, shape out.
      expect(parseBenefits(preset.benefits)).toHaveLength(preset.benefits.length);
    }
  });

  it("stays inside every bound the tier CHECK constraints enforce", () => {
    for (const preset of TIER_PRESETS) {
      expect(preset.name.trim().length).toBeGreaterThanOrEqual(2);
      expect(preset.name.trim().length).toBeLessThanOrEqual(40);
      expect(preset.description.bn.length).toBeLessThanOrEqual(300);
      expect(preset.price).toBeGreaterThanOrEqual(0);
      expect(preset.durationDays).toBeGreaterThanOrEqual(1);
      expect(preset.durationDays).toBeLessThanOrEqual(3650);
      expect(preset.benefits.length).toBeLessThanOrEqual(12);
      for (const b of preset.benefits) {
        expect(b.label.trim().length).toBeGreaterThan(0);
        expect(b.label.length).toBeLessThanOrEqual(80);
      }
    }
  });

  it("has no two presets sharing a name (the per-shop unique index)", () => {
    const names = TIER_PRESETS.map((p) => p.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
