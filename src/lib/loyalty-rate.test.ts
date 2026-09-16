import { describe, expect, it } from "vitest";
import {
  LOYALTY_RATE_MAX,
  LOYALTY_RATE_MIN,
  validateLoyaltyRate,
} from "./loyalty-rate";

describe("a loyalty rate the database would accept", () => {
  it("takes the ordinary values a shop actually uses", () => {
    for (const raw of ["1", "50", "100", "200", "1000", "100000"]) {
      expect(validateLoyaltyRate(raw)).toBeNull();
    }
  });

  it("accepts the bounds themselves, not just what is inside them", () => {
    expect(validateLoyaltyRate(String(LOYALTY_RATE_MIN))).toBeNull();
    expect(validateLoyaltyRate(String(LOYALTY_RATE_MAX))).toBeNull();
  });

  it("tolerates the whitespace a paste leaves behind", () => {
    expect(validateLoyaltyRate(" 50 ")).toBeNull();
  });
});

describe("a loyalty rate it would refuse", () => {
  it("**rejects zero** — floor(bill / 0) is not a number of points", () => {
    expect(validateLoyaltyRate("0")).toBe("out-of-range");
  });

  it("**rejects negatives**", () => {
    expect(validateLoyaltyRate("-1")).toBe("out-of-range");
    expect(validateLoyaltyRate("-100")).toBe("out-of-range");
  });

  it("**rejects absurdly large values** — almost always a typo", () => {
    expect(validateLoyaltyRate(String(LOYALTY_RATE_MAX + 1))).toBe("out-of-range");
    expect(validateLoyaltyRate("99999999")).toBe("out-of-range");
  });

  it("**rejects fractions** — half a point cannot be spent", () => {
    expect(validateLoyaltyRate("50.5")).toBe("not-integer");
    expect(validateLoyaltyRate("0.5")).toBe("not-integer");
  });

  it("reports a fraction as a fraction, not as out of range", () => {
    // "0.5" is both non-integer and below the minimum. Saying "whole numbers
    // only" is the useful half of that; saying "must be at least 1" would send
    // someone off to type 1.5.
    expect(validateLoyaltyRate("0.5")).toBe("not-integer");
  });

  it("rejects text, blanks and the things a numeric input still lets through", () => {
    expect(validateLoyaltyRate("")).toBe("required");
    expect(validateLoyaltyRate("   ")).toBe("required");
    expect(validateLoyaltyRate("abc")).toBe("required");
    expect(validateLoyaltyRate("1e999")).toBe("required"); // Infinity
    expect(validateLoyaltyRate("NaN")).toBe("required");
  });

  it("keeps the two empty-ish cases apart from the too-small case", () => {
    // A half-typed field must not accuse someone of entering a bad number.
    expect(validateLoyaltyRate("")).toBe("required");
    expect(validateLoyaltyRate("0")).toBe("out-of-range");
  });
});
