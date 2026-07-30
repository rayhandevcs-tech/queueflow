import { describe, expect, it } from "vitest";
import { computeAnalyticsSummary, type AnalyticsRow } from "./compute-analytics";

function row(overrides: Partial<AnalyticsRow>): AnalyticsRow {
  return {
    completed_at: "2026-07-27T10:30:00.000Z", // a Monday
    started_at: "2026-07-27T10:10:00.000Z",
    ...overrides,
  };
}

describe("computeAnalyticsSummary", () => {
  it("reports hasData=false and null KPIs for no rows", () => {
    const summary = computeAnalyticsSummary([]);
    expect(summary.hasData).toBe(false);
    expect(summary.dailyAvgCustomers).toBeNull();
    expect(summary.peakHourLabel).toBeNull();
    expect(summary.avgServiceMin).toBeNull();
    expect(summary.insights).toEqual([]);
  });

  it("skips rows with no completed_at", () => {
    const summary = computeAnalyticsSummary([row({ completed_at: null })]);
    expect(summary.hasData).toBe(false);
  });

  it("buckets an hour into the correct 2-hour window and flags the busiest one as peak", () => {
    const rows = [
      row({ completed_at: new Date(2026, 6, 27, 11, 0).toISOString() }), // 11am -> "10a" bucket
      row({ completed_at: new Date(2026, 6, 27, 11, 15).toISOString() }),
      row({ completed_at: new Date(2026, 6, 28, 19, 0).toISOString() }), // 7pm -> "6p" bucket
    ];
    const summary = computeAnalyticsSummary(rows);
    const bucket10a = summary.hourlyLoad.find((b) => b.short === "10a");
    expect(bucket10a?.count).toBe(2);
    expect(bucket10a?.isPeak).toBe(true);
    const bucket6p = summary.hourlyLoad.find((b) => b.short === "6p");
    expect(bucket6p?.count).toBe(1);
    expect(bucket6p?.isPeak).toBe(false);
  });

  it("computes average service duration only from rows with a positive duration", () => {
    const rows = [
      row({ started_at: new Date(2026, 6, 27, 10, 0).toISOString(), completed_at: new Date(2026, 6, 27, 10, 20).toISOString() }),
      row({ started_at: new Date(2026, 6, 27, 10, 0).toISOString(), completed_at: new Date(2026, 6, 27, 10, 30).toISOString() }),
      row({ started_at: null, completed_at: new Date(2026, 6, 27, 10, 30).toISOString() }),
    ];
    const summary = computeAnalyticsSummary(rows);
    expect(summary.avgServiceMin).toBe(25);
  });

  it("ignores a non-positive duration (e.g. bad clock data) when averaging", () => {
    const rows = [
      row({ started_at: new Date(2026, 6, 27, 11, 0).toISOString(), completed_at: new Date(2026, 6, 27, 10, 0).toISOString() }),
    ];
    const summary = computeAnalyticsSummary(rows);
    expect(summary.avgServiceMin).toBeNull();
  });

  it("computes dailyAvgCustomers across distinct active days", () => {
    const rows = [
      row({ completed_at: new Date(2026, 6, 27, 10, 0).toISOString() }),
      row({ completed_at: new Date(2026, 6, 27, 11, 0).toISOString() }),
      row({ completed_at: new Date(2026, 6, 28, 10, 0).toISOString() }),
    ];
    const summary = computeAnalyticsSummary(rows);
    expect(summary.dailyAvgCustomers).toBe(2); // 3 total / 2 distinct days, rounded
  });

  it("labels weekly load in Bangla work-week order (Saturday first) by default", () => {
    const summary = computeAnalyticsSummary([row({})]);
    expect(summary.weeklyLoad.map((b) => b.short)).toEqual(["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র"]);
  });

  it("labels weekly load in English when lang is en", () => {
    const summary = computeAnalyticsSummary([row({})], "en");
    expect(summary.weeklyLoad.map((b) => b.short)).toEqual(["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]);
  });

  it("produces an insight sentence naming the peak day+hour once data exists", () => {
    const summary = computeAnalyticsSummary([row({})], "en");
    expect(summary.insights.length).toBeGreaterThan(0);
    expect(summary.insights[0]).toContain("busiest");
  });
});
