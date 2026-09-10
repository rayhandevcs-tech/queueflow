import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, buildListQuery, hasActiveFilters, type ListFilters } from "./list-query";

/** Local noon, built field by field so the test is zone-independent. */
const NOW = new Date(2026, 8, 10, 12, 0, 0); // 10 September 2026, 12:00 local

function filters(overrides: Partial<ListFilters> = {}): ListFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

/** Local midnight of a Y-M-D, the same way the module builds its bounds. */
function localMidnight(y: number, m: number, d: number): string {
  return new Date(y, m - 1, d).toISOString();
}

describe("buildListQuery", () => {
  it("bounds 'today' to the local calendar day and orders soonest first", () => {
    const q = buildListQuery(filters({ scope: "today" }), NOW);
    expect(q.startFrom).toBe(localMidnight(2026, 9, 10));
    expect(q.startBefore).toBe(localMidnight(2026, 9, 11));
    expect(q.statuses).toBeNull();
    expect(q.ascending).toBe(true);
  });

  it("bounds 'upcoming' at the clock, not at midnight, and drops what is not coming", () => {
    const q = buildListQuery(filters({ scope: "upcoming" }), NOW);
    expect(q.startFrom).toBe(NOW.toISOString());
    expect(q.startBefore).toBeNull();
    expect(q.statuses).toEqual(["BOOKED", "CONFIRMED", "IN_PROGRESS"]);
    expect(q.ascending).toBe(true);
  });

  it("asks only for DONE rows under 'completed', newest first", () => {
    const q = buildListQuery(filters({ scope: "completed" }), NOW);
    expect(q.statuses).toEqual(["DONE"]);
    expect(q.startFrom).toBeNull();
    expect(q.startBefore).toBeNull();
    expect(q.ascending).toBe(false);
  });

  it("puts cancelled and no-show in one scope", () => {
    const q = buildListQuery(filters({ scope: "cancelled" }), NOW);
    expect(q.statuses).toEqual(["CANCELLED", "NO_SHOW"]);
  });

  it("filters nothing under 'all'", () => {
    const q = buildListQuery(filters({ scope: "all" }), NOW);
    expect(q.statuses).toBeNull();
    expect(q.startFrom).toBeNull();
    expect(q.startBefore).toBeNull();
    expect(q.ascending).toBe(false);
  });

  it("treats the 'to' day as inclusive by ending at the next midnight", () => {
    const q = buildListQuery(filters({ scope: "all", from: "2026-09-01", to: "2026-09-10" }), NOW);
    expect(q.startFrom).toBe(localMidnight(2026, 9, 1));
    // The whole of the 10th is inside the range, not excluded by it.
    expect(q.startBefore).toBe(localMidnight(2026, 9, 11));
  });

  it("parses a day as local midnight, not as UTC", () => {
    const q = buildListQuery(filters({ scope: "all", from: "2026-09-10" }), NOW);
    const parsed = new Date(q.startFrom!);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getDate()).toBe(10);
  });

  it("lets an explicit range override the scope's own window", () => {
    // Without the override, 'completed' + a past range would be filtered by
    // an 'upcoming'-style lower bound and return nothing.
    const q = buildListQuery(
      filters({ scope: "upcoming", from: "2026-08-01", to: "2026-08-31" }),
      NOW,
    );
    expect(q.startFrom).toBe(localMidnight(2026, 8, 1));
    expect(q.startBefore).toBe(localMidnight(2026, 9, 1));
    // The scope still decides which statuses are relevant.
    expect(q.statuses).toEqual(["BOOKED", "CONFIRMED", "IN_PROGRESS"]);
  });

  it("keeps the scope's window when only one end of the range is given", () => {
    const q = buildListQuery(filters({ scope: "today", to: "2026-09-30" }), NOW);
    expect(q.startFrom).toBe(localMidnight(2026, 9, 10));
    expect(q.startBefore).toBe(localMidnight(2026, 10, 1));
  });

  it("ignores a malformed day rather than sending a bad bound", () => {
    const q = buildListQuery(filters({ scope: "all", from: "not-a-date" }), NOW);
    expect(q.startFrom).toBeNull();
  });

  it("passes the staff filter through untouched", () => {
    expect(buildListQuery(filters({ staffId: "chair-1" }), NOW).staffId).toBe("chair-1");
    expect(buildListQuery(filters(), NOW).staffId).toBeNull();
  });
});

describe("hasActiveFilters", () => {
  it("is false for the default view", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("is true once any filter is set", () => {
    expect(hasActiveFilters(filters({ scope: "completed" }))).toBe(true);
    expect(hasActiveFilters(filters({ staffId: "chair-1" }))).toBe(true);
    expect(hasActiveFilters(filters({ from: "2026-09-01" }))).toBe(true);
    expect(hasActiveFilters(filters({ to: "2026-09-01" }))).toBe(true);
  });
});
