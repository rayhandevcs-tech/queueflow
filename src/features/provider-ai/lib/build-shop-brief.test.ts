import { describe, expect, it } from "vitest";
import {
  buildShopBrief,
  type BriefChair,
  type BriefExpense,
  type BriefReview,
  type BriefSerial,
  type BriefService,
  type ProgrammeBrief,
} from "./build-shop-brief";

const NOW = new Date("2026-08-20T12:00:00.000Z");

function serial(o: Partial<BriefSerial> = {}): BriefSerial {
  return {
    completed_at: "2026-08-15T10:00:00.000Z",
    created_at: "2026-08-15T09:00:00.000Z",
    total_amount: 100,
    payment_status: "PAID",
    status: "DONE",
    chair_id: "chair-1",
    customer_id: "cust-1",
    services_snapshot: [{ name: "Hair Cutting", rate: 100 }],
    ...o,
  };
}

const chairs: BriefChair[] = [
  { id: "chair-1", label: "চেয়ার ১", staff_name: "রায়হান", is_active: true },
  { id: "chair-2", label: "চেয়ার ২", staff_name: null, is_active: false },
];

const services: BriefService[] = [
  { name: "Hair Cutting", rate: 100, default_duration_min: 40, is_active: true },
  { name: "Beard", rate: 70, default_duration_min: 30, is_active: true },
  { name: "Old", rate: 500, default_duration_min: 60, is_active: false },
];

function build(over: Partial<Parameters<typeof buildShopBrief>[0]> = {}) {
  return buildShopBrief({
    shopName: "GentleMen",
    businessType: "SALON",
    serials: [],
    manualEntries: [],
    expenses: [],
    reviews: [],
    chairs,
    services,
    now: NOW,
    ...over,
  });
}

describe("monthly figures", () => {
  it("groups jobs and revenue by the month they completed in", () => {
    const brief = build({
      serials: [
        serial({ completed_at: "2026-07-03T10:00:00.000Z", total_amount: 200 }),
        serial({ completed_at: "2026-08-01T10:00:00.000Z", total_amount: 100 }),
        serial({ completed_at: "2026-08-09T10:00:00.000Z", total_amount: 150 }),
      ],
    });

    expect(brief.months).toEqual([
      { month: "2026-07", revenue: 200, jobs: 1, due: 0, expenses: 0 },
      { month: "2026-08", revenue: 250, jobs: 2, due: 0, expenses: 0 },
    ]);
  });

  it("returns months oldest first, so they read as a series", () => {
    const brief = build({
      serials: [
        serial({ completed_at: "2026-08-01T10:00:00.000Z" }),
        serial({ completed_at: "2026-06-01T10:00:00.000Z" }),
        serial({ completed_at: "2026-07-01T10:00:00.000Z" }),
      ],
    });
    expect(brief.months.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("keeps uncollected money out of revenue", () => {
    const brief = build({
      serials: [
        serial({ total_amount: 100 }),
        serial({ total_amount: 70, payment_status: "DUE" }),
      ],
    });

    expect(brief.months[0].revenue).toBe(100);
    expect(brief.months[0].due).toBe(70);
    expect(brief.outstanding).toEqual({ jobs: 1, amount: 70 });
  });

  it("counts an expense in the month it was spent on, not entered", () => {
    const expenses: BriefExpense[] = [{ spent_on: "2026-07-01", amount: 3000, category: "RENT" }];
    const brief = build({ expenses });
    expect(brief.months).toEqual([
      { month: "2026-07", revenue: 0, jobs: 0, due: 0, expenses: 3000 },
    ]);
  });

  it("folds manual entries into the same monthly totals", () => {
    const brief = build({
      serials: [serial({ total_amount: 100 })],
      manualEntries: [
        { created_at: "2026-08-16T10:00:00.000Z", amount: 50, payment_status: "PAID" },
      ],
    });
    expect(brief.months[0]).toMatchObject({ revenue: 150, jobs: 2 });
  });
});

describe("what did and didn't happen", () => {
  it("ignores a job that never completed", () => {
    const brief = build({
      serials: [serial({ status: "WAITING", completed_at: null })],
    });
    expect(brief.months).toEqual([]);
  });

  it("counts cancellations and no-shows without counting their money", () => {
    const brief = build({
      serials: [
        serial({ status: "CANCELLED", total_amount: 100 }),
        serial({ status: "NO_SHOW", total_amount: 100 }),
        serial({ total_amount: 100 }),
      ],
    });

    expect(brief.customers.cancelled).toBe(1);
    expect(brief.customers.noShows).toBe(1);
    expect(brief.months[0].revenue).toBe(100);
  });
});

describe("per-service revenue", () => {
  it("splits a multi-service job instead of double-counting it", () => {
    // The whole point: these must add up to what the shop actually earned.
    const brief = build({
      serials: [
        serial({
          total_amount: 170,
          services_snapshot: [
            { name: "Hair Cutting", rate: 100 },
            { name: "Beard", rate: 70 },
          ],
        }),
      ],
    });

    const total = brief.topServices.reduce((sum, s) => sum + s.revenue, 0);
    expect(total).toBe(170);
    expect(brief.topServices.every((s) => s.jobs === 1)).toBe(true);
  });

  it("ranks services by revenue, highest first", () => {
    const brief = build({
      serials: [
        serial({ total_amount: 70, services_snapshot: [{ name: "Beard" }] }),
        serial({ total_amount: 100, services_snapshot: [{ name: "Hair Cutting" }] }),
        serial({ total_amount: 100, services_snapshot: [{ name: "Hair Cutting" }] }),
      ],
    });
    expect(brief.topServices.map((s) => s.name)).toEqual(["Hair Cutting", "Beard"]);
  });

  it("survives a job whose snapshot is missing or malformed", () => {
    const brief = build({
      serials: [serial({ services_snapshot: null }), serial({ services_snapshot: "oops" })],
    });
    expect(brief.topServices).toEqual([]);
    expect(brief.months[0].jobs).toBe(2);
  });
});

describe("staff", () => {
  it("names each chair by its staff member, falling back to the label", () => {
    const brief = build({
      serials: [serial({ chair_id: "chair-1" }), serial({ chair_id: "chair-2" })],
    });
    expect(brief.staff.map((s) => s.name).sort()).toEqual(["চেয়ার ২", "রায়হান"]);
  });

  it("gives a chair the whole job's value, unlike the per-service split", () => {
    const brief = build({
      serials: [
        serial({
          total_amount: 170,
          services_snapshot: [{ name: "Hair Cutting" }, { name: "Beard" }],
        }),
      ],
    });
    expect(brief.staff[0].revenue).toBe(170);
  });
});

describe("customers", () => {
  it("separates repeat customers from one-time ones", () => {
    const brief = build({
      serials: [
        serial({ customer_id: "a" }),
        serial({ customer_id: "a" }),
        serial({ customer_id: "b" }),
      ],
    });
    expect(brief.customers.unique).toBe(2);
    expect(brief.customers.returning).toBe(1);
  });

  it("counts an account-less job as a walk-in", () => {
    const brief = build({
      serials: [serial({ customer_id: null })],
      manualEntries: [
        { created_at: "2026-08-16T10:00:00.000Z", amount: 50, payment_status: "PAID" },
      ],
    });
    expect(brief.customers.walkIns).toBe(2);
    expect(brief.customers.unique).toBe(0);
  });
});

describe("reviews", () => {
  it("averages to one decimal and keeps only recent low-rated comments", () => {
    const reviews: BriefReview[] = [
      { rating: 5, comment: "দারুণ", created_at: "2026-08-01T00:00:00.000Z" },
      { rating: 2, comment: "অনেক দেরি", created_at: "2026-08-10T00:00:00.000Z" },
      { rating: 4, comment: null, created_at: "2026-08-11T00:00:00.000Z" },
    ];
    const brief = build({ reviews });

    expect(brief.reviews.count).toBe(3);
    expect(brief.reviews.average).toBe(3.7);
    expect(brief.reviews.recentComplaints).toEqual(["অনেক দেরি"]);
  });

  it("reports no average rather than zero when nobody has reviewed", () => {
    expect(build().reviews.average).toBeNull();
  });
});

describe("catalogue", () => {
  it("counts only what is currently on offer", () => {
    const brief = build();
    expect(brief.catalogue.activeServices).toBe(2);
    expect(brief.catalogue.activeStaff).toBe(1);
    expect(brief.catalogue.priceRange).toEqual({ min: 70, max: 100 });
  });

  it("reports no price range for a shop with no active services", () => {
    expect(build({ services: [] }).catalogue.priceRange).toBeNull();
  });
});

describe("timing", () => {
  it("ranks hours and weekdays by how busy they were", () => {
    const brief = build({
      serials: [
        serial({ completed_at: "2026-08-15T10:00:00.000Z" }),
        serial({ completed_at: "2026-08-15T10:30:00.000Z" }),
        serial({ completed_at: "2026-08-15T17:00:00.000Z" }),
      ],
    });
    expect(brief.busiestHours[0].jobs).toBe(2);
    expect(brief.busiestHours[0].jobs).toBeGreaterThanOrEqual(brief.busiestHours[1].jobs);
  });
});

describe("an empty shop", () => {
  it("produces a valid brief instead of throwing", () => {
    const brief = build();
    expect(brief.months).toEqual([]);
    expect(brief.topServices).toEqual([]);
    expect(brief.outstanding).toEqual({ jobs: 0, amount: 0 });
    expect(brief.shopName).toBe("GentleMen");
  });
});

describe("the Sprint 10 programme aggregates", () => {
  const programmes: ProgrammeBrief = {
    window: { from: "2026-02-20", to: "2026-08-20" },
    appointments: {
      total: 4,
      completed: 2,
      cancelled: 1,
      noShow: 1,
      upcoming: 0,
      completionRate: 50,
      noShowRate: 25,
      cancelRate: 25,
      avgScheduledMin: 90,
      avgLeadDays: 3,
    },
    queue: {
      total: 7,
      completed: 5,
      cancelled: 1,
      noShow: 1,
      completionRate: 71.4,
      avgServiceMin: 20,
      avgWaitMin: 30,
    },
    loyalty: {
      enabled: true,
      accounts: 3,
      outstandingPoints: 479,
      earnedPoints: 529,
      redeemedPoints: 200,
      referralPoints: 15,
      transactions: 8,
    },
    membership: {
      tiersActive: 1,
      activeMembers: 1,
      pendingMembers: 1,
      expiredMembers: 0,
      expiringSoon: 0,
      newInWindow: 2,
      revenueCollected: 5000,
      revenueDue: 5000,
    },
    referral: {
      enabled: true,
      total: 2,
      pending: 1,
      converted: 1,
      conversionRate: 50,
      customersBrought: 1,
      pointsAwarded: 15,
    },
    rewards: {
      total: 1,
      active: 1,
      redemptionsIssued: 0,
      redemptionsUsed: 1,
      redemptionsExpired: 0,
      useRate: 100,
      pointsSpent: 200,
      discountGiven: 100,
    },
  };

  it("**is null when it was not supplied — not a block of zeros**", () => {
    // A shop whose analytics call failed has not said it has no appointments.
    expect(build().programmes).toBeNull();
    expect(build({ programmes: null }).programmes).toBeNull();
  });

  it("passes the aggregates through untouched", () => {
    const brief = build({ programmes });
    expect(brief.programmes).toEqual(programmes);
    expect(brief.programmes?.appointments?.noShowRate).toBe(25);
    expect(brief.programmes?.referral?.converted).toBe(1);
  });

  it("**does not fold them into the serial-derived figures**", () => {
    // The two cover different windows and different definitions of revenue.
    // Blending them is how the brief would start contradicting the dashboard.
    const brief = build({ serials: [serial({ total_amount: 100 })], programmes });
    expect(brief.months[0].revenue).toBe(100);
    expect(brief.programmes?.membership?.revenueCollected).toBe(5000);
  });

  it("keeps a null rate null, so the model cannot read it as zero", () => {
    const brief = build({
      programmes: {
        ...programmes,
        appointments: {
          total: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          upcoming: 0,
          completionRate: null,
          noShowRate: null,
          cancelRate: null,
          avgScheduledMin: null,
          avgLeadDays: null,
        },
      },
    });
    expect(brief.programmes?.appointments?.noShowRate).toBeNull();
    expect(brief.programmes?.appointments?.total).toBe(0);
  });

  it("survives a programme block being absent on its own", () => {
    const brief = build({ programmes: { ...programmes, rewards: null, loyalty: null } });
    expect(brief.programmes?.rewards).toBeNull();
    expect(brief.programmes?.queue?.total).toBe(7);
  });
});
