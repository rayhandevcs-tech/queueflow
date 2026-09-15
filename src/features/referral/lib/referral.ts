import type { LoyaltySettings, ReferralStatus } from "@/types";

/**
 * Everything about referrals that can be decided without asking the database.
 *
 * Pure and in one file, for the reason `loyalty.ts` and `membership.ts` are:
 * a referral hands out points, points are money-adjacent, and money-adjacent
 * arithmetic should be testable without a browser or a Postgres.
 *
 * The database stays the authority. `isReferralLive()` mirrors
 * `referral_is_live()` in `20260923_referral.sql`, and where the two disagree
 * the database wins — this copy exists so a screen can decide whether to
 * render a share card without a round trip.
 */

/** Bounds mirrored from the CHECK constraints, so the form refuses first. */
export const REFERRAL_POINTS_MIN = 0;
export const REFERRAL_POINTS_MAX = 100_000;

/** What a shop starts on when the owner first opens the switch. */
export const DEFAULT_REFERRER_POINTS = 20;
export const DEFAULT_REFERRED_POINTS = 10;

/** The character set `my_referral_code()` mints from. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** The settings shape a shop with no row behaves as. */
export type ReferralSettingsLike = Pick<
  LoyaltySettings,
  "is_enabled" | "referral_enabled" | "referral_referrer_points" | "referral_referred_points"
>;

/**
 * Is the programme live for this shop?
 *
 * **Both switches, not one.** A referral reward is a loyalty point, so a shop
 * with referral on and loyalty off has promised something it has no ledger to
 * pay from. The database refuses that combination at runtime in three RPCs;
 * this is the same rule, so the UI never offers a code the server would then
 * decline to mint.
 *
 * A missing settings row reads as off, exactly as decision 36 says.
 */
export function isReferralLive(
  settings: ReferralSettingsLike | null | undefined,
): boolean {
  return !!settings?.is_enabled && !!settings?.referral_enabled;
}

/**
 * Could the owner switch referral on right now?
 *
 * Separate from `isReferralLive` because the answer drives a different bit of
 * UI: the settings card needs to explain *why* the switch is unavailable
 * rather than simply hide it.
 */
export function canEnableReferral(
  settings: ReferralSettingsLike | null | undefined,
): boolean {
  return !!settings?.is_enabled;
}

/** Points each side gets, for a shop that may have no row yet. */
export function referralReward(settings: ReferralSettingsLike | null | undefined): {
  referrer: number;
  referred: number;
} {
  return {
    referrer: Math.max(0, settings?.referral_referrer_points ?? 0),
    referred: Math.max(0, settings?.referral_referred_points ?? 0),
  };
}

/**
 * Is a code even worth typing in?
 *
 * Mirrors the `^[A-Z0-9]{6,12}$` CHECK, after the same `upper(btrim(...))` the
 * RPC applies. Used to keep the claim form from making a round trip for
 * something the database will certainly refuse — never to decide whether a
 * code is *real*, which only the database knows.
 */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

export function isCodeShaped(raw: string | null | undefined): boolean {
  return /^[A-Z0-9]{6,12}$/.test(normalizeCode(raw));
}

/**
 * Does this code contain a character `my_referral_code()` never mints?
 *
 * 0/O and 1/I/L are excluded from the alphabet precisely because a code gets
 * read aloud and typed by hand. When someone types one, the likeliest cause is
 * a misread — so the form can say "did you mean O?" instead of "not found".
 */
export function hasAmbiguousChar(raw: string | null | undefined): boolean {
  return normalizeCode(raw)
    .split("")
    .some((char) => /[A-Z0-9]/.test(char) && !CODE_ALPHABET.includes(char));
}

/**
 * Referral row shape these helpers need.
 *
 * Named for what the customer's own list carries (`my_referrals()`), not for
 * the table's columns: `pointsEarned` is the *referrer's* side, because this
 * list is what the person who shared the code is looking at. A row of the
 * `referrals` table itself is never passed here — the one screen that reads
 * one directly reads a single field off it.
 */
export interface ReferralLike {
  status: ReferralStatus;
  /** Null while PENDING; the referrer's points, possibly 0, once CONVERTED. */
  pointsEarned: number | null;
}

export function isConverted(status: ReferralStatus): boolean {
  return status === "CONVERTED";
}

export interface ReferralSummary {
  /** Everyone who typed the code in. */
  total: number;
  /** …of whom this many actually came and finished a job. */
  converted: number;
  /** …and this many have not yet, so nothing has been paid for them. */
  pending: number;
  /** Points the referrer has actually been paid. */
  pointsEarned: number;
  /** 0–100, of those who claimed. 0 when nobody has claimed yet. */
  conversionPct: number;
}

/**
 * The customer's own four numbers, and the owner's per-referrer row.
 *
 * Computed client-side from rows the screen already holds, deliberately not a
 * second RPC — the same call `summarize()` makes in `loyalty.ts`.
 */
export function summarizeReferrals(
  rows: readonly ReferralLike[],
): ReferralSummary {
  let converted = 0;
  let pointsEarned = 0;

  for (const row of rows) {
    if (isConverted(row.status)) {
      converted += 1;
      pointsEarned += Math.max(0, row.pointsEarned ?? 0);
    }
  }

  const total = rows.length;
  return {
    total,
    converted,
    pending: total - converted,
    pointsEarned,
    conversionPct: total === 0 ? 0 : Math.round((converted / total) * 100),
  };
}

/**
 * Newest first, and within the same instant the unconverted ones first.
 *
 * A pending referral is the one the referrer might still act on — a nudge is
 * worth more at the top of the list than a reward already banked.
 */
export function sortReferrals<T extends ReferralLike & { createdAt: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) ||
      Number(isConverted(a.status)) - Number(isConverted(b.status)),
  );
}

/**
 * The message that travels with the code on WhatsApp.
 *
 * Built here rather than in the component so it can be unit-tested and so the
 * two places that share (the button and the copy-to-clipboard fallback) can
 * never drift. Bangla by default, like the rest of the product.
 */
export function shareMessage(input: {
  shopName: string;
  code: string;
  referredPoints: number;
  lang?: "bn" | "en";
}): string {
  const { shopName, code, referredPoints } = input;
  const bonus =
    referredPoints > 0
      ? input.lang === "en"
        ? ` You'll get ${referredPoints} points on your first visit.`
        : ` প্রথম কাজেই তোমার ${referredPoints} পয়েন্ট।`
      : "";

  return input.lang === "en"
    ? `I book at ${shopName}. Use my referral code ${code} when you book.${bonus}`
    : `আমি ${shopName}-এ কাজ করাই। বুকিংয়ের সময় আমার রেফারেল কোড ${code} দিয়ো।${bonus}`;
}
