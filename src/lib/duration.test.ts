import { describe, expect, it } from "vitest";
import {
  MAX_DURATION_MIN,
  formatDuration,
  joinDuration,
  splitDuration,
} from "./duration";

describe("splitDuration", () => {
  it("breaks minutes into hours and minutes", () => {
    expect(splitDuration(30)).toEqual({ hours: 0, minutes: 30 });
    expect(splitDuration(60)).toEqual({ hours: 1, minutes: 0 });
    expect(splitDuration(90)).toEqual({ hours: 1, minutes: 30 });
    expect(splitDuration(150)).toEqual({ hours: 2, minutes: 30 });
    expect(splitDuration(480)).toEqual({ hours: 8, minutes: 0 });
  });

  it("clamps nonsense rather than propagating it into the form", () => {
    expect(splitDuration(0)).toEqual({ hours: 0, minutes: 0 });
    expect(splitDuration(-30)).toEqual({ hours: 0, minutes: 0 });
    expect(splitDuration(Number.NaN)).toEqual({ hours: 0, minutes: 0 });
    expect(splitDuration(45.6)).toEqual({ hours: 0, minutes: 46 });
  });
});

describe("joinDuration", () => {
  it("adds the two boxes up", () => {
    expect(joinDuration({ hours: 0, minutes: 30 })).toBe(30);
    expect(joinDuration({ hours: 1, minutes: 0 })).toBe(60);
    expect(joinDuration({ hours: 1, minutes: 30 })).toBe(90);
    expect(joinDuration({ hours: 2, minutes: 0 })).toBe(120);
  });

  // Typing 90 in the minutes box means an hour and a half. Rejecting it would
  // be pedantry; carrying it is what the person meant.
  it("carries minutes past 59 into hours", () => {
    expect(joinDuration({ hours: 0, minutes: 90 })).toBe(90);
    expect(joinDuration({ hours: 1, minutes: 75 })).toBe(135);
  });

  it("never returns a value the database would refuse", () => {
    expect(joinDuration({ hours: 20, minutes: 0 })).toBe(MAX_DURATION_MIN);
    expect(joinDuration({ hours: 8, minutes: 30 })).toBe(MAX_DURATION_MIN);
    expect(joinDuration({ hours: -3, minutes: -10 })).toBe(0);
    expect(joinDuration({ hours: Number.NaN, minutes: 30 })).toBe(30);
  });

  it("round-trips with splitDuration for every whole minute up to the cap", () => {
    for (let min = 0; min <= MAX_DURATION_MIN; min += 5) {
      expect(joinDuration(splitDuration(min))).toBe(min);
    }
  });
});

describe("formatDuration", () => {
  // The test environment has no stored language, which resolves to Bangla —
  // the app's default.
  it("says minutes alone under an hour", () => {
    expect(formatDuration(30)).toBe("৩০ মিনিট");
    expect(formatDuration(45)).toBe("৪৫ মিনিট");
  });

  it("drops the minutes when there are none", () => {
    expect(formatDuration(60)).toBe("১ ঘণ্টা");
    expect(formatDuration(120)).toBe("২ ঘণ্টা");
  });

  it("says both when both are there", () => {
    expect(formatDuration(90)).toBe("১ ঘণ্টা ৩০ মিনিট");
    expect(formatDuration(150)).toBe("২ ঘণ্টা ৩০ মিনিট");
  });

  // A long parlour service is the whole reason this exists: "২১০ মিনিট" is a
  // number an owner has to do arithmetic on.
  it("keeps a long service readable", () => {
    expect(formatDuration(210)).toBe("৩ ঘণ্টা ৩০ মিনিট");
    expect(formatDuration(480)).toBe("৮ ঘণ্টা");
  });

  it("shows zero as zero minutes rather than an empty string", () => {
    expect(formatDuration(0)).toBe("০ মিনিট");
  });
});
