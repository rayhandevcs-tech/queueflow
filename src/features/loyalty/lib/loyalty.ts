import type { LoyaltySettings, LoyaltyTransaction, LoyaltyTransactionKind } from "@/types";

/**
 * Everything about loyalty points that can be decided without asking the
 * database.
 *
 * Pure and in one file, for the reason `compute-due-ledger.ts` and
 * `membership.ts` are: points are money-adjacent, and money-adjacent
 * arithmetic should be testable without a browser or a Postgres.
 *
 * The database is still the authority. `pointsForBill()` below is a mirror of
 * `points_for_bill()` in `20260922_loyalty.sql`, and where the two disagree
 * the database wins — this copy exists so the owner's settings screen can
 * preview "a ৳800 bill earns 8 points" without a round trip.
 */

/** The default a shop starts on: ৳100 of bill earns one point. */
export const DEFAULT_TAKA_PER_POINT = 100;

/** Bounds mirrored from the CHECK constraints, so the form refuses first. */
export const TAKA_PER_POINT_MIN = 1;
export const TAKA_PER_POINT_MAX = 100_000;

/**
 * Points a bill earns.
 *
 * `floor`, never rounding: a shop that says "প্রতি ১০০ টাকায় ১ পয়েন্ট" has
 * promised a point per completed hundred, and rounding ৳150 up to 2 would be
 * giving away a point it never offered. Half points don't exist because half a
 * point cannot be spent.
 *
 * Returns 0 rather than throwing for every degenerate input — a nonsense rate
 * should cost a customer nothing, not break the screen they're looking at.
 */
export function pointsForBill(
  bill: number | null | undefined,
  takaPerPoint: number | null | undefined,
  minBill: number | null | undefined = 0,
): number {
  if (bill == null || takaPerPoint == null) return 0;
  if (!Number.isFinite(bill) || !Number.isFinite(takaPerPoint)) return 0;
  if (takaPerPoint <= 0) return 0;
  if (bill < (minBill ?? 0)) return 0;
  return Math.max(0, Math.floor(bill / takaPerPoint));
}

/** What the settings form previews: a worked example in the owner's own rate. */
export function previewEarn(
  takaPerPoint: number,
  minBill: number,
  sampleBill: number,
): { bill: number; points: number; belowFloor: boolean } {
  return {
    bill: sampleBill,
    points: pointsForBill(sampleBill, takaPerPoint, minBill),
    belowFloor: sampleBill < minBill,
  };
}

/** The settings shape a shop with no row behaves as (decision 36). */
export type SettingsLike = Pick<
  LoyaltySettings,
  "is_enabled" | "taka_per_point" | "min_bill_taka"
>;

/**
 * Is the programme live for this shop?
 *
 * A missing row and `is_enabled = false` mean the same thing, and both mean
 * "show nothing anywhere" — the same call decision 36 made for offers and
 * membership. Every UI branch reads this rather than testing for null itself,
 * so the two cases can never drift apart.
 */
export function isLoyaltyLive(settings: SettingsLike | null | undefined): boolean {
  return !!settings?.is_enabled;
}

/** The rate to display or compute with, for a shop that may have no row yet. */
export function effectiveRate(settings: SettingsLike | null | undefined): number {
  const rate = settings?.taka_per_point;
  return rate && rate > 0 ? rate : DEFAULT_TAKA_PER_POINT;
}

/**
 * How much more this customer must spend to earn their next point.
 *
 * The one number that makes a point balance feel like progress rather than
 * trivia. Below the shop's floor the answer is the floor itself, because
 * that — not the rate — is what actually stands between them and a point.
 */
export function takaToNextPoint(
  settings: SettingsLike | null | undefined,
  nextBill = 0,
): number {
  const rate = effectiveRate(settings);
  const floor = settings?.min_bill_taka ?? 0;
  if (nextBill < floor) return Math.max(0, floor - nextBill);
  const remainder = nextBill % rate;
  return remainder === 0 ? rate : rate - remainder;
}

/** Ledger row shape these helpers need — a real row satisfies it. */
export type LedgerLike = Pick<LoyaltyTransaction, "points" | "kind" | "created_at">;

/**
 * The invariant the plan names: balance is exactly the ledger's sum.
 *
 * Not a display helper — a check. Decision 32 makes the balance a cache of
 * this number, so anything that can recompute it should, and anything that
 * finds a mismatch has found a real bug.
 */
export function ledgerSum(rows: readonly LedgerLike[]): number {
  return rows.reduce((total, row) => total + row.points, 0);
}

/** True when a cached balance and its ledger agree. */
export function balanceMatchesLedger(
  balance: number,
  rows: readonly LedgerLike[],
): boolean {
  return balance === ledgerSum(rows);
}

/**
 * Lifetime earned, recomputed from the ledger.
 *
 * Only the positive rows, because `lifetime_earned` answers "how much has
 * this customer ever earned here" — a correction that takes points away does
 * not un-earn what came before it.
 */
export function lifetimeEarnedFromLedger(rows: readonly LedgerLike[]): number {
  return rows.reduce((total, row) => total + Math.max(0, row.points), 0);
}

/**
 * Kinds that represent earning rather than a correction.
 *
 * The two referral kinds belong here too, from Sprint 8: a referral bonus is
 * points the customer earned, not a number an owner fixed by hand. Only
 * `ADJUST` is a correction.
 */
const EARN_KINDS: readonly LoyaltyTransactionKind[] = [
  "EARN_SERIAL",
  "EARN_APPOINTMENT",
  "REFERRAL_REFERRER",
  "REFERRAL_REFERRED",
];

export function isEarnKind(kind: LoyaltyTransactionKind): boolean {
  return EARN_KINDS.includes(kind);
}

/**
 * Newest first, for the customer's card history and the owner's drawer.
 *
 * Ties break on the sign of the change, so an award and the correction that
 * followed it in the same second read in the order they happened rather than
 * in whatever order the rows came back.
 */
export function sortLedger<T extends LedgerLike>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.points - a.points,
  );
}

export interface LoyaltySummary {
  /** Members with a non-zero balance — the ones the programme is working on. */
  memberCount: number;
  /** Points the shop currently owes. Its outstanding obligation. */
  outstandingPoints: number;
  /** Everything ever awarded here, corrections included. */
  lifetimePoints: number;
  topBalance: number;
}

/**
 * The owner's four numbers, computed client-side from the account rows.
 *
 * Deliberately not a new RPC: the owner's page already loads every account to
 * render the table, so a second round trip would be asking the database to
 * count rows the browser is holding. (Membership needed an RPC because its
 * tiles count rows the table does *not* load.)
 */
export function summarize(
  accounts: readonly { balance: number; lifetime_earned: number }[],
): LoyaltySummary {
  let outstandingPoints = 0;
  let lifetimePoints = 0;
  let memberCount = 0;
  let topBalance = 0;

  for (const account of accounts) {
    outstandingPoints += account.balance;
    lifetimePoints += account.lifetime_earned;
    if (account.balance > 0) memberCount += 1;
    if (account.balance > topBalance) topBalance = account.balance;
  }

  return { memberCount, outstandingPoints, lifetimePoints, topBalance };
}
