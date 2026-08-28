import { describe, expect, it } from "vitest";
import { buildCustomerBrief, type BriefActiveSerial } from "./build-customer-brief";

const NOW = new Date("2026-08-20T12:00:00.000Z");

type HistoryRow = Parameters<typeof buildCustomerBrief>[0]["history"][number];

function visit(o: Partial<HistoryRow> = {}): HistoryRow {
  return {
    completed_at: "2026-08-15T10:00:00.000Z",
    status: "DONE",
    payment_status: "PAID",
    total_amount: 100,
    due_amount: 0,
    shop_name: "GentleMen",
    services: ["Hair Cutting"],
    ...o,
  };
}

function build(over: Partial<Parameters<typeof buildCustomerBrief>[0]> = {}) {
  return buildCustomerBrief({
    name: "রহিম",
    activeBooking: null,
    history: [],
    now: NOW,
    ...over,
  });
}

describe("what the customer owes", () => {
  it("sums the recorded due, not the full bill", () => {
    // A job billed at 300 with 100 still owed must not report 300 outstanding.
    const brief = build({
      history: [visit({ payment_status: "DUE", total_amount: 300, due_amount: 100 })],
    });
    expect(brief.outstanding).toEqual({ visits: 1, amount: 100 });
  });

  it("falls back to the bill when no due amount was recorded", () => {
    const brief = build({
      history: [visit({ payment_status: "DUE", total_amount: 70, due_amount: 0 })],
    });
    expect(brief.outstanding.amount).toBe(70);
  });

  it("counts nothing owed when everything was paid", () => {
    const brief = build({ history: [visit(), visit()] });
    expect(brief.outstanding).toEqual({ visits: 0, amount: 0 });
  });

  it("ignores an unpaid job that never completed", () => {
    const brief = build({
      history: [visit({ status: "CANCELLED", payment_status: "DUE", due_amount: 100 })],
    });
    expect(brief.outstanding).toEqual({ visits: 0, amount: 0 });
  });
});

describe("history", () => {
  it("counts only completed visits, and tracks the rest separately", () => {
    const brief = build({
      history: [
        visit(),
        visit({ status: "CANCELLED" }),
        visit({ status: "NO_SHOW" }),
        visit({ status: "WAITING", completed_at: null }),
      ],
    });
    expect(brief.habits.totalVisits).toBe(1);
    expect(brief.habits.cancelled).toBe(1);
    expect(brief.habits.noShows).toBe(1);
  });

  it("lists recent visits newest first and caps them at five", () => {
    const history = Array.from({ length: 8 }, (_, i) =>
      visit({ completed_at: `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00.000Z` }),
    );
    const brief = build({ history });

    expect(brief.recentVisits).toHaveLength(5);
    expect(brief.recentVisits[0].completed_at).toBe("2026-08-08T10:00:00.000Z");
    expect(brief.recentVisits[4].completed_at).toBe("2026-08-04T10:00:00.000Z");
  });

  it("finds the usual shop and service", () => {
    const brief = build({
      history: [
        visit({ shop_name: "GentleMen", services: ["Hair Cutting"] }),
        visit({ shop_name: "GentleMen", services: ["Hair Cutting"] }),
        visit({ shop_name: "Capital", services: ["Beard"] }),
      ],
    });
    expect(brief.habits.usualShop).toBe("GentleMen");
    expect(brief.habits.usualService).toBe("Hair Cutting");
  });

  it("reports no usual shop for someone with no completed visits", () => {
    const brief = build({ history: [visit({ status: "CANCELLED" })] });
    expect(brief.habits.usualShop).toBeNull();
    expect(brief.habits.usualService).toBeNull();
  });
});

describe("the active booking", () => {
  it("passes it through untouched", () => {
    const booking: BriefActiveSerial = {
      position: 3,
      status: "WAITING",
      estimated_start_at: "2026-08-20T12:40:00.000Z",
      started_at: null,
      estimated_duration_min: 40,
      called_at: null,
      arrived_at: null,
      is_walk_in: false,
      shop_name: "GentleMen",
      services: ["Hair Cutting"],
      total_amount: 100,
      aheadOnChair: 2,
    };
    expect(build({ activeBooking: booking }).activeBooking).toEqual(booking);
  });

  it("is null for someone with no booking right now", () => {
    expect(build().activeBooking).toBeNull();
  });
});

describe("an account with no history at all", () => {
  it("produces a valid brief rather than throwing", () => {
    const brief = build();
    expect(brief.recentVisits).toEqual([]);
    expect(brief.habits.totalVisits).toBe(0);
    expect(brief.name).toBe("রহিম");
  });
});
