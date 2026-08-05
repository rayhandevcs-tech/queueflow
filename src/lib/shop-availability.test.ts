import { describe, expect, it } from "vitest";
import { breakMinutesLeft, canBookNow, shopAvailability } from "./shop-availability";

const NOW = new Date("2026-08-05T10:00:00Z").getTime();
const inMinutes = (n: number) => new Date(NOW + n * 60_000).toISOString();

describe("shopAvailability", () => {
  it("treats a closed shop as closed whatever else is set", () => {
    expect(
      shopAvailability({ is_open: false, accepting_new: true, break_until: null }, NOW),
    ).toBe("CLOSED");
  });

  it("reports the blocking state ahead of the informational one", () => {
    // Both true at once: the customer needs to hear the one that stops them.
    expect(
      shopAvailability(
        { is_open: true, accepting_new: false, break_until: inMinutes(10) },
        NOW,
      ),
    ).toBe("NOT_ACCEPTING");
  });

  it("reports a live break", () => {
    expect(
      shopAvailability({ is_open: true, accepting_new: true, break_until: inMinutes(10) }, NOW),
    ).toBe("BREAK");
  });

  it("ignores a break that has already ended", () => {
    expect(
      shopAvailability({ is_open: true, accepting_new: true, break_until: inMinutes(-1) }, NOW),
    ).toBe("OPEN");
  });

  it("stays open when the new columns don't exist yet", () => {
    // Deploy-before-migration: absent columns must not black out the shop.
    expect(shopAvailability({ is_open: true }, NOW)).toBe("OPEN");
  });

  it("treats a missing shop as closed", () => {
    expect(shopAvailability(null, NOW)).toBe("CLOSED");
    expect(shopAvailability(undefined, NOW)).toBe("CLOSED");
  });
});

describe("breakMinutesLeft", () => {
  it("rounds up so a 30-second remainder still reads as a minute", () => {
    expect(breakMinutesLeft({ is_open: true, break_until: inMinutes(0.5) }, NOW)).toBe(1);
  });

  it("is zero with no break, or a past one", () => {
    expect(breakMinutesLeft({ is_open: true, break_until: null }, NOW)).toBe(0);
    expect(breakMinutesLeft({ is_open: true, break_until: inMinutes(-5) }, NOW)).toBe(0);
  });

  it("survives a malformed timestamp", () => {
    expect(breakMinutesLeft({ is_open: true, break_until: "not-a-date" }, NOW)).toBe(0);
  });
});

describe("canBookNow", () => {
  it("lets a customer book during a break — it only pushes their ETA back", () => {
    expect(
      canBookNow({ is_open: true, accepting_new: true, break_until: inMinutes(20) }, NOW),
    ).toBe(true);
  });

  it("blocks booking when closed or not accepting", () => {
    expect(canBookNow({ is_open: false }, NOW)).toBe(false);
    expect(canBookNow({ is_open: true, accepting_new: false }, NOW)).toBe(false);
  });
});
