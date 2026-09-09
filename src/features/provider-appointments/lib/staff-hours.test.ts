import { describe, expect, it } from "vitest";
import { emptyWeeklyHours, type WeeklyHours } from "@/lib/weekly-hours";
import type { StaffWorkingHours } from "@/types";
import {
  dayKeyOfIso,
  effectiveWindow,
  hoursByWeekday,
  isClippedByShop,
  isFullDay,
  isoDowOf,
  overlapsDay,
  type IsoWeekday,
} from "./staff-hours";

function row(over: Partial<StaffWorkingHours> = {}): StaffWorkingHours {
  return {
    chair_id: "c1",
    weekday: 3,
    start_time: "10:00:00",
    end_time: "18:00:00",
    created_at: "",
    updated_at: "",
    ...over,
  };
}

function shop(over: Partial<WeeklyHours> = {}): WeeklyHours {
  return { ...emptyWeeklyHours(), ...over };
}

describe("isoDowOf / dayKeyOfIso", () => {
  it("counts Monday as 1 and Sunday as 7", () => {
    // 2026-09-07 is a Monday.
    const expected: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
    expected.forEach((dow, i) => {
      expect(isoDowOf(new Date(2026, 8, 7 + i))).toBe(dow);
    });
  });

  it("maps each isodow back to its weekly_hours key", () => {
    const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    keys.forEach((key, i) => expect(dayKeyOfIso((i + 1) as IsoWeekday)).toBe(key));
  });

  // The two numberings agreeing is the whole reason there is one mapping.
  it("agrees with itself round-trip for a whole week", () => {
    for (let i = 0; i < 7; i++) {
      const date = new Date(2026, 8, 7 + i);
      const key = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][(date.getDay() + 6) % 7];
      expect(dayKeyOfIso(isoDowOf(date))).toBe(key);
    }
  });
});

describe("hoursByWeekday", () => {
  it("keeps only the rows for the chair asked about", () => {
    const rows = [
      row({ chair_id: "c1", weekday: 1 }),
      row({ chair_id: "c2", weekday: 1 }),
      row({ chair_id: "c1", weekday: 5 }),
    ];
    const mine = hoursByWeekday(rows, "c1");
    expect([...mine.keys()].sort()).toEqual([1, 5]);
    expect(hoursByWeekday(rows, "c2").size).toBe(1);
    expect(hoursByWeekday(rows, "nobody").size).toBe(0);
  });
});

describe("effectiveWindow", () => {
  it("is the overlap of the shop's hours and the staff member's", () => {
    // Shop 10–20, staff 12–18 → 12–18.
    const hours = shop({ wed: { open: "10:00", close: "20:00", closed: false } });
    expect(effectiveWindow(hours, row({ start_time: "12:00:00", end_time: "18:00:00" }), 3)).toEqual(
      { openMin: 720, closeMin: 1080 },
    );
  });

  // The staff member's own hours can be wider than the shop's; the shop wins.
  it("clips staff hours that reach past the shop's", () => {
    const hours = shop({ wed: { open: "11:00", close: "17:00", closed: false } });
    expect(effectiveWindow(hours, row({ start_time: "09:00:00", end_time: "21:00:00" }), 3)).toEqual(
      { openMin: 660, closeMin: 1020 },
    );
  });

  // A missing row is how "does not work that day" is spelled (decision 46).
  it("gives nothing when the staff member has no row for that day", () => {
    expect(effectiveWindow(shop(), null, 3)).toBeNull();
    expect(effectiveWindow(shop(), undefined, 3)).toBeNull();
  });

  it("gives nothing when the shop is shut that day", () => {
    const hours = shop({ wed: { open: "10:00", close: "20:00", closed: true } });
    expect(effectiveWindow(hours, row(), 3)).toBeNull();
  });

  it("gives nothing when the two windows never meet", () => {
    const hours = shop({ wed: { open: "18:00", close: "20:00", closed: false } });
    expect(effectiveWindow(hours, row({ start_time: "09:00:00", end_time: "13:00:00" }), 3)).toBeNull();
  });

  // Same tolerance the insert trigger has, so the screen and the database
  // cannot disagree about a shop that never set its hours.
  it("treats unset shop hours as no constraint", () => {
    expect(effectiveWindow(null, row({ start_time: "09:00:00", end_time: "13:00:00" }), 3)).toEqual({
      openMin: 540,
      closeMin: 780,
    });
  });

  it("refuses a staff row whose end is not after its start", () => {
    expect(effectiveWindow(shop(), row({ start_time: "18:00:00", end_time: "18:00:00" }), 3)).toBeNull();
    expect(effectiveWindow(shop(), row({ start_time: "18:00:00", end_time: "09:00:00" }), 3)).toBeNull();
  });
});

describe("isClippedByShop", () => {
  it("is true only when the shop actually narrows the staff's hours", () => {
    const narrow = shop({ wed: { open: "11:00", close: "17:00", closed: false } });
    expect(isClippedByShop(narrow, row({ start_time: "09:00:00", end_time: "21:00:00" }), 3)).toBe(true);
    expect(isClippedByShop(narrow, row({ start_time: "12:00:00", end_time: "16:00:00" }), 3)).toBe(false);
  });

  it("is false when there is no window at all", () => {
    expect(isClippedByShop(shop(), null, 3)).toBe(false);
  });
});

describe("overlapsDay", () => {
  const day = new Date(2026, 8, 9);

  it("catches leave that covers the whole day", () => {
    expect(
      overlapsDay(
        { starts_at: new Date(2026, 8, 9).toISOString(), ends_at: new Date(2026, 8, 10).toISOString() },
        day,
      ),
    ).toBe(true);
  });

  it("catches leave that covers only part of it", () => {
    expect(
      overlapsDay(
        {
          starts_at: new Date(2026, 8, 9, 10).toISOString(),
          ends_at: new Date(2026, 8, 9, 13).toISOString(),
        },
        day,
      ),
    ).toBe(true);
  });

  it("catches a multi-day period passing through", () => {
    expect(
      overlapsDay(
        { starts_at: new Date(2026, 8, 7).toISOString(), ends_at: new Date(2026, 8, 12).toISOString() },
        day,
      ),
    ).toBe(true);
  });

  it("ignores leave on other days", () => {
    expect(
      overlapsDay(
        { starts_at: new Date(2026, 8, 10).toISOString(), ends_at: new Date(2026, 8, 11).toISOString() },
        day,
      ),
    ).toBe(false);
  });

  // A period ending exactly at midnight belongs to the day before, not this one.
  it("treats the midnight boundary as exclusive", () => {
    expect(
      overlapsDay(
        { starts_at: new Date(2026, 8, 8).toISOString(), ends_at: new Date(2026, 8, 9).toISOString() },
        day,
      ),
    ).toBe(false);
  });

  it("ignores an unparseable period rather than throwing", () => {
    expect(overlapsDay({ starts_at: "nonsense", ends_at: "also nonsense" }, day)).toBe(false);
  });
});

describe("isFullDay", () => {
  it("recognises midnight to midnight", () => {
    expect(
      isFullDay({
        starts_at: new Date(2026, 8, 9).toISOString(),
        ends_at: new Date(2026, 8, 10).toISOString(),
      }),
    ).toBe(true);
  });

  it("does not call a half day a full one", () => {
    expect(
      isFullDay({
        starts_at: new Date(2026, 8, 9, 10).toISOString(),
        ends_at: new Date(2026, 8, 9, 13).toISOString(),
      }),
    ).toBe(false);
  });
});
