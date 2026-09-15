import { describe, expect, it } from "vitest";
import {
  DEFAULT_REFERRED_POINTS,
  DEFAULT_REFERRER_POINTS,
  canEnableReferral,
  hasAmbiguousChar,
  isCodeShaped,
  isConverted,
  isReferralLive,
  normalizeCode,
  referralReward,
  shareMessage,
  sortReferrals,
  summarizeReferrals,
  type ReferralLike,
  type ReferralSettingsLike,
} from "./referral";

function settings(overrides: Partial<ReferralSettingsLike> = {}): ReferralSettingsLike {
  return {
    is_enabled: true,
    referral_enabled: true,
    referral_referrer_points: 20,
    referral_referred_points: 10,
    ...overrides,
  };
}

function referral(overrides: Partial<ReferralLike & { createdAt: string }> = {}) {
  return {
    status: "PENDING" as const,
    pointsEarned: null,
    createdAt: "2026-09-15T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// the switch — both halves, never one
// ---------------------------------------------------------------------------

describe("isReferralLive", () => {
  it("is live when loyalty and referral are both on", () => {
    expect(isReferralLive(settings())).toBe(true);
  });

  it("is NOT live with referral on but loyalty off", () => {
    // A referral reward is a loyalty point. Without a loyalty programme the
    // shop would be promising something it has no ledger to pay from.
    expect(isReferralLive(settings({ is_enabled: false }))).toBe(false);
  });

  it("is NOT live with loyalty on but referral off", () => {
    expect(isReferralLive(settings({ referral_enabled: false }))).toBe(false);
  });

  it("treats a missing settings row as off (decision 36)", () => {
    expect(isReferralLive(null)).toBe(false);
    expect(isReferralLive(undefined)).toBe(false);
  });
});

describe("canEnableReferral", () => {
  it("needs loyalty on, whatever referral currently says", () => {
    expect(canEnableReferral(settings({ referral_enabled: false }))).toBe(true);
    expect(canEnableReferral(settings({ is_enabled: false }))).toBe(false);
    expect(canEnableReferral(null)).toBe(false);
  });
});

describe("referralReward", () => {
  it("reads both sides off the settings", () => {
    expect(referralReward(settings())).toEqual({ referrer: 20, referred: 10 });
  });

  it("a shop may pay one side nothing", () => {
    expect(referralReward(settings({ referral_referred_points: 0 }))).toEqual({
      referrer: 20,
      referred: 0,
    });
  });

  it("never returns a negative, even from bad data", () => {
    expect(referralReward(settings({ referral_referrer_points: -5 }))).toEqual({
      referrer: 0,
      referred: 10,
    });
  });

  it("a missing row pays nothing", () => {
    expect(referralReward(null)).toEqual({ referrer: 0, referred: 0 });
  });

  it("the defaults the form starts on are both positive", () => {
    expect(DEFAULT_REFERRER_POINTS).toBeGreaterThan(0);
    expect(DEFAULT_REFERRED_POINTS).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// the code, as typed by a human
// ---------------------------------------------------------------------------

describe("normalizeCode", () => {
  it("upper-cases and trims, matching upper(btrim(...)) in the RPC", () => {
    expect(normalizeCode("  ab7k2m  ")).toBe("AB7K2M");
  });

  it("survives null and undefined", () => {
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode(undefined)).toBe("");
  });
});

describe("isCodeShaped", () => {
  it("accepts a code the database would accept", () => {
    expect(isCodeShaped("AB7K2M")).toBe(true);
    expect(isCodeShaped("ab7k2m")).toBe(true);
    expect(isCodeShaped("  AB7K2M ")).toBe(true);
  });

  it("refuses one that is too short or too long", () => {
    expect(isCodeShaped("AB7K2")).toBe(false);
    expect(isCodeShaped("AB7K2MAB7K2MA")).toBe(false);
  });

  it("refuses punctuation and spaces inside", () => {
    expect(isCodeShaped("AB7-K2M")).toBe(false);
    expect(isCodeShaped("AB7 K2M")).toBe(false);
  });

  it("refuses an empty box", () => {
    expect(isCodeShaped("")).toBe(false);
    expect(isCodeShaped("   ")).toBe(false);
  });
});

describe("hasAmbiguousChar", () => {
  it("spots the characters the minter never uses", () => {
    // 0/O and 1/I/L are excluded from the alphabet on purpose, so one of them
    // in a typed code is almost always a misread rather than a real code.
    for (const code of ["AB0K2M", "ABOK2M", "AB1K2M", "ABIK2M", "ABLK2M"]) {
      expect(hasAmbiguousChar(code)).toBe(true);
    }
  });

  it("is quiet about a code made of minted characters" , () => {
    expect(hasAmbiguousChar("AB7K2M")).toBe(false);
    expect(hasAmbiguousChar("ZY9X8W")).toBe(false);
  });

  it("ignores characters that are not code characters at all", () => {
    expect(hasAmbiguousChar("AB-K2M")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// counting
// ---------------------------------------------------------------------------

describe("isConverted", () => {
  it("names the one status that has been paid for", () => {
    expect(isConverted("CONVERTED")).toBe(true);
    expect(isConverted("PENDING")).toBe(false);
  });
});

describe("summarizeReferrals", () => {
  it("counts an empty list without dividing by zero", () => {
    expect(summarizeReferrals([])).toEqual({
      total: 0,
      converted: 0,
      pending: 0,
      pointsEarned: 0,
      conversionPct: 0,
    });
  });

  it("separates who came from who only typed the code", () => {
    const summary = summarizeReferrals([
      referral({ status: "CONVERTED", pointsEarned: 20 }),
      referral({ status: "CONVERTED", pointsEarned: 20 }),
      referral(),
      referral(),
    ]);
    expect(summary).toEqual({
      total: 4,
      converted: 2,
      pending: 2,
      pointsEarned: 40,
      conversionPct: 50,
    });
  });

  it("pays nothing for a pending referral, even one carrying a number", () => {
    // A PENDING row should never carry points — the CHECK constraint forbids
    // it — but if one ever did, the summary must not pay for it.
    const summary = summarizeReferrals([referral({ pointsEarned: 999 })]);
    expect(summary.pointsEarned).toBe(0);
    expect(summary.pending).toBe(1);
  });

  it("counts a converted referral that earned 0 (the shop pays that side nothing)", () => {
    const summary = summarizeReferrals([
      referral({ status: "CONVERTED", pointsEarned: 0 }),
    ]);
    expect(summary.converted).toBe(1);
    expect(summary.pointsEarned).toBe(0);
    expect(summary.conversionPct).toBe(100);
  });

  it("rounds the percentage rather than showing a fraction", () => {
    expect(
      summarizeReferrals([
        referral({ status: "CONVERTED", pointsEarned: 20 }),
        referral(),
        referral(),
      ]).conversionPct,
    ).toBe(33);
  });
});

describe("sortReferrals", () => {
  it("puts the newest first", () => {
    const rows = sortReferrals([
      referral({ createdAt: "2026-09-01T10:00:00.000Z" }),
      referral({ createdAt: "2026-09-10T10:00:00.000Z" }),
    ]);
    expect(rows[0].createdAt).toBe("2026-09-10T10:00:00.000Z");
  });

  it("within the same instant, the one still worth a nudge comes first", () => {
    const rows = sortReferrals([
      referral({ status: "CONVERTED", pointsEarned: 20 }),
      referral(),
    ]);
    expect(rows[0].status).toBe("PENDING");
  });

  it("does not mutate the caller's array", () => {
    const input = [
      referral({ createdAt: "2026-09-01T10:00:00.000Z" }),
      referral({ createdAt: "2026-09-10T10:00:00.000Z" }),
    ];
    sortReferrals(input);
    expect(input[0].createdAt).toBe("2026-09-01T10:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// what gets sent
// ---------------------------------------------------------------------------

describe("shareMessage", () => {
  it("carries the shop, the code and the newcomer's bonus, in Bangla", () => {
    const text = shareMessage({ shopName: "রূপছায়া", code: "AB7K2M", referredPoints: 10 });
    expect(text).toContain("রূপছায়া");
    expect(text).toContain("AB7K2M");
    expect(text).toContain("10 পয়েন্ট");
  });

  it("drops the bonus sentence when the shop pays the newcomer nothing", () => {
    const text = shareMessage({ shopName: "রূপছায়া", code: "AB7K2M", referredPoints: 0 });
    expect(text).toContain("AB7K2M");
    expect(text).not.toContain("পয়েন্ট");
  });

  it("can speak English when the customer has chosen it", () => {
    const text = shareMessage({
      shopName: "Rupchaya",
      code: "AB7K2M",
      referredPoints: 10,
      lang: "en",
    });
    expect(text).toContain("referral code AB7K2M");
    expect(text).toContain("10 points");
  });
});
