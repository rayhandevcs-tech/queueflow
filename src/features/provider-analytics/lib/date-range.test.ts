import { describe, expect, it } from "vitest";
import {
  MAX_RANGE_SPAN_DAYS,
  addDays,
  daySpan,
  includesFuture,
  isValidRange,
  parseYmd,
  presetFor,
  presetRange,
  rangeDays,
  rangeKey,
  rangeProblem,
  trendBucket,
} from "./date-range";

// A Tuesday, mid-month, so no preset lands on a month or week edge by luck.
const TODAY = new Date(2026, 8, 15); // 15 Sep 2026

describe("parseYmd", () => {
  it("reads a date as local midnight, not as UTC", () => {
    const parsed = parseYmd("2026-09-15");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(15);
    // The bug this guards: `new Date("2026-09-15")` is UTC midnight, which in
    // Dhaka (UTC+6) is still the 15th — but `getDate()` on a UTC-parsed value
    // in a negative offset would be the 14th. Field-by-field construction is
    // the only reading that is the same everywhere.
    expect(parsed?.getHours()).toBe(0);
  });

  it("refuses anything that is not a plain YYYY-MM-DD", () => {
    expect(parseYmd("")).toBeNull();
    expect(parseYmd(null)).toBeNull();
    expect(parseYmd(undefined)).toBeNull();
    expect(parseYmd("2026-9-15")).toBeNull();
    expect(parseYmd("15/09/2026")).toBeNull();
    expect(parseYmd("2026-09-15T10:00:00Z")).toBeNull();
  });

  it("refuses a day that does not exist instead of rolling it over", () => {
    // `new Date(2026, 1, 31)` silently becomes 3 March — a range starting on
    // a typo would then quietly report the wrong period.
    expect(parseYmd("2026-02-31")).toBeNull();
    expect(parseYmd("2026-13-01")).toBeNull();
    expect(parseYmd("2026-00-10")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(parseYmd("2028-02-29")).not.toBeNull();
    expect(parseYmd("2026-02-29")).toBeNull();
  });
});

describe("day arithmetic", () => {
  it("counts the span between two days, not the days themselves", () => {
    expect(daySpan(new Date(2026, 8, 15), new Date(2026, 8, 15))).toBe(0);
    expect(daySpan(new Date(2026, 8, 15), new Date(2026, 8, 16))).toBe(1);
    expect(daySpan(new Date(2026, 8, 16), new Date(2026, 8, 15))).toBe(-1);
  });

  it("crosses a month and a year boundary correctly", () => {
    expect(daySpan(new Date(2026, 7, 31), new Date(2026, 8, 1))).toBe(1);
    expect(daySpan(new Date(2026, 11, 31), new Date(2027, 0, 1))).toBe(1);
  });

  it("addDays moves without mutating its argument", () => {
    const start = new Date(2026, 8, 15);
    const later = addDays(start, 5);
    expect(later.getDate()).toBe(20);
    expect(start.getDate()).toBe(15);
  });
});

describe("the presets", () => {
  it("today is a one-day range, both ends the same", () => {
    expect(presetRange("TODAY", TODAY)).toEqual({ from: "2026-09-15", to: "2026-09-15" });
    expect(rangeDays(presetRange("TODAY", TODAY))).toBe(1);
  });

  it("**last 7 days includes today** — 7 days, not 8", () => {
    expect(presetRange("LAST_7", TODAY)).toEqual({ from: "2026-09-09", to: "2026-09-15" });
    expect(rangeDays(presetRange("LAST_7", TODAY))).toBe(7);
  });

  it("last 30 days is 30 inclusive days", () => {
    expect(presetRange("LAST_30", TODAY)).toEqual({ from: "2026-08-17", to: "2026-09-15" });
    expect(rangeDays(presetRange("LAST_30", TODAY))).toBe(30);
  });

  it("this month runs from the 1st to today, not to the month's end", () => {
    expect(presetRange("THIS_MONTH", TODAY)).toEqual({ from: "2026-09-01", to: "2026-09-15" });
  });

  it("this month on the 1st is a single day", () => {
    const first = new Date(2026, 8, 1);
    expect(presetRange("THIS_MONTH", first)).toEqual({ from: "2026-09-01", to: "2026-09-01" });
  });

  it("crosses a month boundary backwards without landing on day 0", () => {
    const secondOfMarch = new Date(2026, 2, 2);
    expect(presetRange("LAST_7", secondOfMarch)).toEqual({
      from: "2026-02-24",
      to: "2026-03-02",
    });
  });

  it("a custom preset opens on the last 30 days rather than on nothing", () => {
    expect(presetRange("CUSTOM", TODAY)).toEqual(presetRange("LAST_30", TODAY));
  });
});

describe("presetFor", () => {
  it("recognises each preset it produced", () => {
    for (const preset of ["TODAY", "LAST_7", "LAST_30", "THIS_MONTH"] as const) {
      expect(presetFor(presetRange(preset, TODAY), TODAY)).toBe(preset);
    }
  });

  it("calls anything else custom", () => {
    expect(presetFor({ from: "2026-01-01", to: "2026-01-31" }, TODAY)).toBe("CUSTOM");
    // One day short of "last 7" is genuinely a custom range, not a near-miss.
    expect(presetFor({ from: "2026-09-10", to: "2026-09-15" }, TODAY)).toBe("CUSTOM");
  });

  it("does not report a preset for a range that ends before today", () => {
    expect(presetFor({ from: "2026-09-08", to: "2026-09-14" }, TODAY)).toBe("CUSTOM");
  });
});

describe("validation mirrors analytics_scope()", () => {
  it("accepts a normal range", () => {
    expect(rangeProblem({ from: "2026-09-01", to: "2026-09-15" })).toBeNull();
    expect(isValidRange({ from: "2026-09-01", to: "2026-09-15" })).toBe(true);
  });

  it("accepts a single day — from == to is legal, not empty", () => {
    expect(rangeProblem({ from: "2026-09-15", to: "2026-09-15" })).toBeNull();
  });

  it("rejects a reversed range, the way the SQL raises analytics_range_reversed", () => {
    expect(rangeProblem({ from: "2026-09-15", to: "2026-09-01" })).toBe("REVERSED");
  });

  it("rejects a malformed date, the way the SQL raises analytics_range_required", () => {
    expect(rangeProblem({ from: "", to: "2026-09-15" })).toBe("MALFORMED");
    expect(rangeProblem({ from: "2026-09-15", to: "not-a-date" })).toBe("MALFORMED");
  });

  it("**allows exactly the widest span the server allows, and no more**", () => {
    const from = new Date(2024, 0, 1);
    const ok = { from: "2024-01-01", to: toYmd(addDays(from, MAX_RANGE_SPAN_DAYS)) };
    const tooWide = { from: "2024-01-01", to: toYmd(addDays(from, MAX_RANGE_SPAN_DAYS + 1)) };
    // The SQL raises when `(p_to - p_from) > 1095`, so a span of exactly 1095
    // passes — which is 1096 inclusive days.
    expect(rangeProblem(ok)).toBeNull();
    expect(rangeDays(ok)).toBe(MAX_RANGE_SPAN_DAYS + 1);
    expect(rangeProblem(tooWide)).toBe("TOO_WIDE");
  });

  it("a future range is valid — it is empty, not wrong", () => {
    // The harness asserts the same thing in SQL: a future-only window returns
    // zeros rather than an error, because tomorrow's diary is a real question.
    expect(rangeProblem({ from: "2027-01-01", to: "2027-01-31" })).toBeNull();
  });
});

describe("rangeDays", () => {
  it("counts both ends", () => {
    expect(rangeDays({ from: "2026-09-15", to: "2026-09-15" })).toBe(1);
    expect(rangeDays({ from: "2026-09-01", to: "2026-09-30" })).toBe(30);
  });

  it("is null for a range it cannot read", () => {
    expect(rangeDays({ from: "x", to: "2026-09-15" })).toBeNull();
  });
});

describe("trendBucket", () => {
  it("uses daily bars up to 90 days", () => {
    expect(trendBucket(presetRange("TODAY", TODAY))).toBe("DAY");
    expect(trendBucket(presetRange("LAST_30", TODAY))).toBe("DAY");
    expect(trendBucket({ from: "2026-06-18", to: "2026-09-15" })).toBe("DAY"); // 90 days
  });

  it("switches to months past that, where daily bars stop being readable", () => {
    expect(trendBucket({ from: "2026-06-17", to: "2026-09-15" })).toBe("MONTH"); // 91
    expect(trendBucket({ from: "2024-09-15", to: "2026-09-15" })).toBe("MONTH");
  });

  it("falls back to daily for a range it cannot measure", () => {
    expect(trendBucket({ from: "", to: "" })).toBe("DAY");
  });
});

describe("includesFuture", () => {
  it("is false for a window that ends today or earlier", () => {
    expect(includesFuture(presetRange("TODAY", TODAY), TODAY)).toBe(false);
    expect(includesFuture(presetRange("LAST_7", TODAY), TODAY)).toBe(false);
  });

  it("is true for one that runs past today", () => {
    expect(includesFuture({ from: "2026-09-15", to: "2026-09-20" }, TODAY)).toBe(true);
  });
});

describe("rangeKey", () => {
  it("is a stable string for the same two dates", () => {
    expect(rangeKey({ from: "2026-09-01", to: "2026-09-15" })).toBe("2026-09-01..2026-09-15");
    // Two separately-built objects must key identically, or the query cache
    // refetches on every render.
    expect(rangeKey(presetRange("LAST_7", TODAY))).toBe(rangeKey(presetRange("LAST_7", TODAY)));
  });

  it("differs between ranges that share an end", () => {
    expect(rangeKey({ from: "2026-09-01", to: "2026-09-15" })).not.toBe(
      rangeKey({ from: "2026-09-02", to: "2026-09-15" }),
    );
  });
});

function toYmd(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
