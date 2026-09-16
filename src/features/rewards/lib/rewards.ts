import type { RewardKind, RewardRedemption, RedemptionStatus } from "@/types";
import {
  canRedeem,
  DISCOUNT_PCT_MAX,
  isRewardAvailable,
  POINTS_COST_MAX,
  POINTS_COST_MIN,
  pointsShort,
  type RedeemBlock,
  type RewardLike,
} from "@/lib/reward-eligibility";

/**
 * Everything about rewards that can be decided without asking the database.
 *
 * Pure and in one file, for the reason `loyalty.ts`, `referral.ts` and
 * `membership.ts` are: a redemption spends points and moves money, and
 * money-adjacent arithmetic should be testable without a browser or a
 * Postgres.
 *
 * The database stays the authority. `discountFor()` below is a mirror of
 * `reward_discount_for()` in `20260924_rewards.sql`, and where the two
 * disagree the database wins — this copy exists so a card can say "this saves
 * you ৳80 on today's bill" without a round trip.
 */

/**
 * Eligibility moved to `@/lib/reward-eligibility` in AI Sprint 4 and is
 * re-exported here, so every existing import keeps working and there is still
 * exactly ONE implementation of "can this be redeemed".
 *
 * It had to move because the assistant asks the same question, and `src/lib`
 * may not import a feature (`eslint-plugin-boundaries`). Copying the rules into
 * the AI layer would have been the second eligibility implementation this
 * sprint's brief forbids — and the two would have drifted, which is how an
 * assistant ends up offering a reward the button refuses.
 */
export {
  canRedeem,
  DISCOUNT_PCT_MAX,
  isRewardAvailable,
  POINTS_COST_MAX,
  POINTS_COST_MIN,
  pointsShort,
  type RedeemBlock,
  type RewardLike,
};

/** Bounds mirrored from the CHECK constraints, so the form refuses first. */
export const REWARD_NAME_MAX = 60;
export const REWARD_DESCRIPTION_MAX = 300;

/** The three kinds the plan specifies. Not four, not five. */
export const REWARD_KINDS = ["DISCOUNT_FLAT", "DISCOUNT_PCT", "FREE_SERVICE"] as const;

/** One entry of a booking's `services_snapshot`. */
export interface SnapshotService {
  service_id: string;
  name?: string;
  rate?: number;
}

/**
 * Taka off a bill for one reward.
 *
 * **Never more than the bill itself.** A ৳500 flat reward on a ৳300 bill is
 * ৳300 off, not a ৳200 refund — a shop that hands money back was never what
 * "৳500 off" promised.
 *
 * `FREE_SERVICE` reads the rate from the booking's own snapshot rather than
 * the service's current price, because the snapshot is what the customer was
 * quoted. A service that is not in the booking is worth 0 here; the server
 * refuses that case outright rather than granting nothing silently.
 */
export function discountFor(
  reward: Pick<RewardLike, "kind" | "value" | "service_id">,
  total: number | null | undefined,
  snapshot: readonly SnapshotService[] = [],
): number {
  if (total == null || !Number.isFinite(total) || total <= 0) return 0;

  switch (reward.kind) {
    case "DISCOUNT_FLAT": {
      const flat = Math.max(0, reward.value ?? 0);
      return round2(Math.min(flat, total));
    }
    case "DISCOUNT_PCT": {
      const pct = Math.min(Math.max(0, reward.value ?? 0), DISCOUNT_PCT_MAX);
      return round2(Math.min((total * pct) / 100, total));
    }
    case "FREE_SERVICE": {
      const line = snapshot.find((entry) => entry.service_id === reward.service_id);
      return round2(Math.min(Math.max(0, line?.rate ?? 0), total));
    }
    default:
      return 0;
  }
}

/** Two decimal places, like `numeric(10,2)` — and without float dust. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** What the bill becomes. Never negative. */
export function billAfter(total: number, discount: number): number {
  return round2(Math.max(0, total - discount));
}

// ---------------------------------------------------------------------------
// a coupon in hand
// ---------------------------------------------------------------------------

/** The shape these helpers need — a real `reward_redemptions` row satisfies it. */
export type RedemptionLike = Pick<RewardRedemption, "status" | "expires_at">;

/**
 * What a coupon is really worth to its holder right now.
 *
 * `EXPIRED` is computed rather than trusted: the nightly sweep sets the
 * column, but a coupon whose `expires_at` passed an hour ago is already dead
 * and the screen must not offer it. The server agrees — it refuses an
 * out-of-date coupon before the sweep has run.
 */
export type RedemptionState = "USABLE" | "USED" | "EXPIRED";

export function redemptionState(
  redemption: RedemptionLike,
  now: Date = new Date(),
): RedemptionState {
  if (redemption.status === "USED") return "USED";
  if (redemption.status === "EXPIRED") return "EXPIRED";
  if (
    redemption.expires_at &&
    new Date(redemption.expires_at).getTime() < now.getTime()
  ) {
    return "EXPIRED";
  }
  return "USABLE";
}

export function isUsable(redemption: RedemptionLike, now: Date = new Date()): boolean {
  return redemptionState(redemption, now) === "USABLE";
}

// ---------------------------------------------------------------------------
// the code, as typed by a human
// ---------------------------------------------------------------------------

/** Mirrors `upper(btrim(...))` in `mark_redemption_used()`. */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/** Mirrors the `^[A-Z0-9]{6,12}$` CHECK, so the form refuses first. */
export function isCodeShaped(raw: string | null | undefined): boolean {
  return /^[A-Z0-9]{6,12}$/.test(normalizeCode(raw));
}

// ---------------------------------------------------------------------------
// lists and totals
// ---------------------------------------------------------------------------

/**
 * The owner's order, and the customer's.
 *
 * `sort_order` first because that is the owner's own arrangement; then the
 * cheapest, because a customer scanning a shelf is looking for what they can
 * afford; then the name, so the order is stable rather than arbitrary.
 */
export function sortRewards<T extends { sort_order: number; points_cost: number; name: string }>(
  rewards: readonly T[],
): T[] {
  return [...rewards].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.points_cost - b.points_cost ||
      a.name.localeCompare(b.name),
  );
}

export interface CatalogueSummary {
  /** Rewards the owner has created, switched-off ones included. */
  total: number
  /** …of which this many are actually on the shelf right now. */
  available: number;
  /** The cheapest thing on the shelf, or 0 when the shelf is empty. */
  cheapest: number;
}

/**
 * The owner's catalogue numbers, computed from rows the page already holds —
 * deliberately not a second RPC, the same call `summarize()` makes in
 * `loyalty.ts`.
 */
export function summarizeCatalogue(
  rewards: readonly RewardLike[],
  now: Date = new Date(),
): CatalogueSummary {
  let available = 0;
  let cheapest = 0;

  for (const reward of rewards) {
    if (!isRewardAvailable(reward, now)) continue;
    available += 1;
    if (cheapest === 0 || reward.points_cost < cheapest) cheapest = reward.points_cost;
  }

  return { total: rewards.length, available, cheapest };
}

/** Kinds that reduce a bill by a number the owner chose. */
export function isDiscountKind(kind: RewardKind): boolean {
  return kind === "DISCOUNT_FLAT" || kind === "DISCOUNT_PCT";
}

/** Statuses a coupon can hold. Three, not four — there is no CANCELLED. */
export const REDEMPTION_STATUSES: readonly RedemptionStatus[] = [
  "ISSUED",
  "USED",
  "EXPIRED",
];
