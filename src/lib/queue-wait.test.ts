import { describe, expect, it } from "vitest";
import { chairFreeAtMs, minutesUntil } from "./queue-wait";
import type { QueuePublicRow } from "@/types";

function row(overrides: Partial<QueuePublicRow>): QueuePublicRow {
  return {
    id: "serial-1",
    shop_id: "shop-1",
    chair_id: "chair-1",
    position: 1,
    status: "WAITING",
    is_walk_in: false,
    estimated_duration_min: 20,
    estimated_start_at: "2026-07-30T10:00:00.000Z",
    updated_at: "2026-07-30T09:00:00.000Z",
    ...overrides,
  };
}

describe("chairFreeAtMs", () => {
  it("returns an empty map for no rows", () => {
    expect(chairFreeAtMs([]).size).toBe(0);
  });

  it("skips rows with no estimated_start_at (e.g. done/cancelled)", () => {
    const rows = [row({ estimated_start_at: null })];
    expect(chairFreeAtMs(rows).size).toBe(0);
  });

  it("computes free-at as start + duration for a single row", () => {
    const rows = [row({ chair_id: "c1", estimated_start_at: "2026-07-30T10:00:00.000Z", estimated_duration_min: 20 })];
    const free = chairFreeAtMs(rows);
    expect(free.get("c1")).toBe(new Date("2026-07-30T10:20:00.000Z").getTime());
  });

  it("keeps the latest free-at time when a chair has multiple queued rows", () => {
    const rows = [
      row({ chair_id: "c1", estimated_start_at: "2026-07-30T10:00:00.000Z", estimated_duration_min: 20 }),
      row({ chair_id: "c1", estimated_start_at: "2026-07-30T10:20:00.000Z", estimated_duration_min: 30 }),
    ];
    const free = chairFreeAtMs(rows);
    expect(free.get("c1")).toBe(new Date("2026-07-30T10:50:00.000Z").getTime());
  });

  it("groups separately by chair_id by default", () => {
    const rows = [
      row({ chair_id: "c1", estimated_start_at: "2026-07-30T10:00:00.000Z", estimated_duration_min: 20 }),
      row({ chair_id: "c2", estimated_start_at: "2026-07-30T09:00:00.000Z", estimated_duration_min: 10 }),
    ];
    const free = chairFreeAtMs(rows);
    expect(free.size).toBe(2);
    expect(free.get("c1")).toBe(new Date("2026-07-30T10:20:00.000Z").getTime());
    expect(free.get("c2")).toBe(new Date("2026-07-30T09:10:00.000Z").getTime());
  });

  it("supports a custom groupKey (e.g. grouping by shop instead of chair)", () => {
    const rows = [
      row({ shop_id: "s1", chair_id: "c1", estimated_start_at: "2026-07-30T10:00:00.000Z", estimated_duration_min: 20 }),
      row({ shop_id: "s1", chair_id: "c2", estimated_start_at: "2026-07-30T11:00:00.000Z", estimated_duration_min: 5 }),
    ];
    const free = chairFreeAtMs(rows, (r) => r.shop_id);
    expect(free.size).toBe(1);
    expect(free.get("s1")).toBe(new Date("2026-07-30T11:05:00.000Z").getTime());
  });
});

describe("minutesUntil", () => {
  it("returns null for an empty list", () => {
    expect(minutesUntil([], Date.now())).toBeNull();
  });

  it("rounds to the nearest minute", () => {
    const now = new Date("2026-07-30T10:00:00.000Z").getTime();
    const freeAt = new Date("2026-07-30T10:05:30.000Z").getTime();
    expect(minutesUntil([freeAt], now)).toBe(6);
  });

  it("clamps a past free-at time to 0, never negative", () => {
    const now = new Date("2026-07-30T10:00:00.000Z").getTime();
    const freeAt = new Date("2026-07-30T09:00:00.000Z").getTime();
    expect(minutesUntil([freeAt], now)).toBe(0);
  });

  it("picks the soonest of several free-at times", () => {
    const now = new Date("2026-07-30T10:00:00.000Z").getTime();
    const freeAtList = [
      new Date("2026-07-30T10:30:00.000Z").getTime(),
      new Date("2026-07-30T10:10:00.000Z").getTime(),
      new Date("2026-07-30T11:00:00.000Z").getTime(),
    ];
    expect(minutesUntil(freeAtList, now)).toBe(10);
  });
});
