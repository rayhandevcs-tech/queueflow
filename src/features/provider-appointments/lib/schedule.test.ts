import { describe, expect, it } from "vitest";
import { emptyWeeklyHours, type WeeklyHours } from "@/lib/weekly-hours";
import {
  blockPosition,
  dayKeyOf,
  dayWindow,
  formatHm,
  groupByStaff,
  isSameDay,
  minutesOfDay,
  nowLinePct,
  parseHm,
  timeRows,
  ymd,
} from "./schedule";
import type { AppointmentCard } from "./types";

/** A Wednesday, so the weekday mapping is exercised away from both edges. */
const WED = new Date(2026, 8, 9);
const WINDOW = { openMin: 600, closeMin: 1200 }; // 10:00 – 20:00

function hoursWith(overrides: Partial<WeeklyHours>): WeeklyHours {
  return { ...emptyWeeklyHours(), ...overrides };
}

function appt(startsAt: string, endsAt: string, over: Partial<AppointmentCard> = {}): AppointmentCard {
  return {
    id: "a1",
    staffId: "s1",
    customerName: "রুমা",
    customerAvatarUrl: null,
    serviceNames: ["ফেসিয়াল"],
    startsAt,
    endsAt,
    status: "BOOKED",
    totalAmount: 0,
    ...over,
  };
}

/** Local-time ISO for the test day, so the maths doesn't depend on the TZ. */
function at(h: number, m = 0): string {
  return new Date(2026, 8, 9, h, m).toISOString();
}

describe("parseHm / formatHm", () => {
  it("reads a real clock time", () => {
    expect(parseHm("10:00")).toBe(600);
    expect(parseHm("09:30")).toBe(570);
    expect(parseHm("23:59")).toBe(1439);
    expect(parseHm("9:05")).toBe(545);
  });

  it("refuses anything that isn't one", () => {
    for (const bad of [null, undefined, "", "10", "10:0", "abc", "24:00", "10:60", "1000"]) {
      expect(parseHm(bad)).toBeNull();
    }
  });

  it("round-trips through formatHm", () => {
    for (const minutes of [0, 545, 600, 1200, 1439]) {
      expect(parseHm(formatHm(minutes))).toBe(minutes);
    }
  });
});

describe("dayKeyOf", () => {
  it("maps Sunday-first getDay() onto the Monday-first week", () => {
    // 2026-09-07 is a Monday.
    const week = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    week.forEach((key, i) => {
      expect(dayKeyOf(new Date(2026, 8, 7 + i))).toBe(key);
    });
  });
});

describe("dayWindow", () => {
  it("reads the day's own open and close", () => {
    const hours = hoursWith({ wed: { open: "11:00", close: "21:30", closed: false } });
    expect(dayWindow(hours, WED)).toEqual({ openMin: 660, closeMin: 1290 });
  });

  it("gives no grid when the shop is shut that day", () => {
    const hours = hoursWith({ wed: { open: "10:00", close: "20:00", closed: true } });
    expect(dayWindow(hours, WED)).toBeNull();
  });

  it("gives no grid for missing or unusable hours", () => {
    expect(dayWindow(null, WED)).toBeNull();
    expect(dayWindow(hoursWith({ wed: { open: null, close: "20:00", closed: false } }), WED)).toBeNull();
    expect(dayWindow(hoursWith({ wed: { open: "bad", close: "20:00", closed: false } }), WED)).toBeNull();
  });

  // A shop that closes at or before it opens is either a typo or runs past
  // midnight; both would draw a negative-height column.
  it("refuses a close time that isn't after the open time", () => {
    expect(dayWindow(hoursWith({ wed: { open: "20:00", close: "20:00", closed: false } }), WED)).toBeNull();
    expect(dayWindow(hoursWith({ wed: { open: "20:00", close: "02:00", closed: false } }), WED)).toBeNull();
  });
});

describe("timeRows", () => {
  it("walks the window in slot steps and includes the closing edge", () => {
    const rows = timeRows({ openMin: 600, closeMin: 720 });
    expect(rows).toEqual([600, 630, 660, 690, 720]);
  });

  it("still closes the grid when the window isn't a whole number of slots", () => {
    const rows = timeRows({ openMin: 600, closeMin: 645 });
    expect(rows).toEqual([600, 630, 645]);
    expect(rows.at(-1)).toBe(645);
  });
});

describe("blockPosition", () => {
  it("places a booking as a percentage of the open window", () => {
    // 13:00–14:00 inside 10:00–20:00 → 3h into a 10h day, 1h tall.
    const pos = blockPosition(appt(at(13), at(14)), WINDOW, WED);
    expect(pos).not.toBeNull();
    expect(pos!.topPct).toBeCloseTo(30);
    expect(pos!.heightPct).toBeCloseTo(10);
    expect(pos!.clippedStart).toBe(false);
    expect(pos!.clippedEnd).toBe(false);
  });

  it("sits flush at each edge", () => {
    expect(blockPosition(appt(at(10), at(11)), WINDOW, WED)!.topPct).toBeCloseTo(0);
    const last = blockPosition(appt(at(19), at(20)), WINDOW, WED)!;
    expect(last.topPct + last.heightPct).toBeCloseTo(100);
  });

  // An overrunning booking is the one an owner most needs to see, so it is
  // clamped into view and flagged rather than dropped.
  it("clamps an overrun instead of hiding it", () => {
    const pos = blockPosition(appt(at(19, 30), at(21)), WINDOW, WED)!;
    expect(pos.topPct + pos.heightPct).toBeCloseTo(100);
    expect(pos.clippedEnd).toBe(true);
    expect(pos.clippedStart).toBe(false);

    const early = blockPosition(appt(at(9), at(10, 30)), WINDOW, WED)!;
    expect(early.topPct).toBeCloseTo(0);
    expect(early.clippedStart).toBe(true);
  });

  it("drops what genuinely isn't on this day's board", () => {
    expect(blockPosition(appt(at(7), at(9)), WINDOW, WED)).toBeNull();
    expect(blockPosition(appt(at(20), at(21)), WINDOW, WED)).toBeNull();
    // Another date entirely.
    const other = new Date(2026, 8, 10, 13).toISOString();
    const otherEnd = new Date(2026, 8, 10, 14).toISOString();
    expect(blockPosition(appt(other, otherEnd), WINDOW, WED)).toBeNull();
  });

  it("rejects a zero-length or reversed booking rather than drawing it", () => {
    expect(blockPosition(appt(at(13), at(13)), WINDOW, WED)).toBeNull();
    expect(blockPosition(appt(at(14), at(13)), WINDOW, WED)).toBeNull();
    expect(blockPosition(appt("not-a-date", at(13)), WINDOW, WED)).toBeNull();
  });
});

describe("nowLinePct", () => {
  it("marks the current time when the board is showing today", () => {
    const now = new Date(2026, 8, 9, 15, 0);
    expect(nowLinePct(now, WINDOW, WED)).toBeCloseTo(50);
  });

  it("stays hidden outside the open window or on another day", () => {
    expect(nowLinePct(new Date(2026, 8, 9, 8), WINDOW, WED)).toBeNull();
    expect(nowLinePct(new Date(2026, 8, 9, 22), WINDOW, WED)).toBeNull();
    expect(nowLinePct(new Date(2026, 8, 10, 15), WINDOW, WED)).toBeNull();
  });
});

describe("minutesOfDay / isSameDay", () => {
  it("counts minutes since local midnight", () => {
    expect(minutesOfDay(new Date(2026, 8, 9, 0, 0))).toBe(0);
    expect(minutesOfDay(new Date(2026, 8, 9, 14, 30))).toBe(870);
  });

  it("compares calendar days, not instants", () => {
    expect(isSameDay(new Date(2026, 8, 9, 0, 1), new Date(2026, 8, 9, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 8, 9), new Date(2026, 8, 10))).toBe(false);
    expect(isSameDay(new Date(2026, 8, 9), new Date(2025, 8, 9))).toBe(false);
  });
});

describe("ymd", () => {
  it("pads to a stable YYYY-MM-DD", () => {
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(ymd(WED)).toBe("2026-09-09");
  });

  // The reason this exists instead of toISOString().slice(0,10): east of UTC,
  // an early-morning board would otherwise key itself to yesterday.
  it("uses the local day, not the UTC one", () => {
    const justAfterMidnight = new Date(2026, 8, 9, 0, 30);
    expect(ymd(justAfterMidnight)).toBe("2026-09-09");
  });
});

describe("groupByStaff", () => {
  it("buckets by staff and orders each column by start time", () => {
    const rows = [
      appt(at(15), at(16), { id: "c", staffId: "s1" }),
      appt(at(11), at(12), { id: "a", staffId: "s2" }),
      appt(at(13), at(14), { id: "b", staffId: "s1" }),
    ];
    const grouped = groupByStaff(rows);
    expect([...grouped.keys()].sort()).toEqual(["s1", "s2"]);
    expect(grouped.get("s1")!.map((a) => a.id)).toEqual(["b", "c"]);
    expect(grouped.get("s2")!.map((a) => a.id)).toEqual(["a"]);
  });

  it("returns an empty map for an empty day", () => {
    expect(groupByStaff([]).size).toBe(0);
  });
});
