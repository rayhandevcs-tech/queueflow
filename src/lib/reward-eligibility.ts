import type { Reward } from "@/types";

/**
 * Whether a reward can be redeemed, and if not, why not.
 *
 * ---------------------------------------------------------------------------
 * Why this lives in `src/lib` rather than in the rewards feature
 * ---------------------------------------------------------------------------
 * It used to live in `src/features/rewards/lib/rewards.ts`, which was the right
 * place while the redemption button was the only thing that asked the question.
 * AI Sprint 4 gave the assistant a second caller, and `src/lib` may not import
 * a feature — `eslint-plugin-boundaries` allows `shared → shared` and nothing
 * else, for good reasons that have nothing to do with this file.
 *
 * That left two options: copy the rules into the AI layer, or promote them.
 * Copying would have created a second eligibility implementation, and the brief
 * for this sprint is explicit that there must not be one ("Use existing reward
 * rules. Do not recreate eligibility logic in AI"). More to the point, two
 * copies would eventually disagree, and then the assistant would offer a reward
 * the button refuses, or refuse one the button offers — and the customer would
 * be right either way to stop believing both.
 *
 * So it moved here, and `src/features/rewards/lib/rewards.ts` re-exports it.
 * Every existing import keeps working, including the feature's own tests, and
 * there is exactly one answer to "can this be redeemed".
 *
 * ---------------------------------------------------------------------------
 * The database is still the authority
 * ---------------------------------------------------------------------------
 * `redeem_reward()` re-checks all of this inside the transaction that spends
 * the points, with the reward row and the account row locked, and the
 * `balance >= 0` CHECK underneath. What this file buys is a reason: it turns
 * "that did not work" into "you are 30 points short", and it lets a button be
 * disabled before a pointless round trip. It is never the guarantee, and the
 * check order below deliberately matches the RPC's so the stated reason is the
 * one the server would also have given.
 */

/** Bounds mirrored from the CHECK constraints, so a form refuses first. */
export const POINTS_COST_MIN = 1;
export const POINTS_COST_MAX = 1_000_000;
export const DISCOUNT_PCT_MAX = 100;

/** The shape these helpers need — a real `rewards` row satisfies it. */
export type RewardLike = Pick<
  Reward,
  "kind" | "value" | "service_id" | "points_cost" | "is_active" | "stock" | "valid_until"
>;

/**
 * Is this reward offerable at all, regardless of who is looking?
 *
 * Three independent reasons a reward is not on the shelf: switched off, past
 * its `valid_until`, or out of stock. A customer's balance has nothing to do
 * with it — that is `canRedeem` below.
 */
export function isRewardAvailable(
  reward: RewardLike | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!reward) return false;
  if (!reward.is_active) return false;
  if (reward.valid_until && new Date(reward.valid_until).getTime() < now.getTime()) return false;
  if (reward.stock != null && reward.stock <= 0) return false;
  return true;
}

/**
 * Why a reward cannot be redeemed right now, or null when it can.
 *
 * `OUT_OF_STOCK` is this product's redemption limit. There is no per-customer
 * redemption cap in the schema — `rewards.stock` is "how many more may be
 * issued" in total — so a limit is enforced by that column and nothing else.
 * Worth saying plainly rather than implying a per-customer limit exists.
 */
export type RedeemBlock =
  | "INACTIVE"
  | "OFFER_EXPIRED"
  | "OUT_OF_STOCK"
  | "NOT_ENOUGH_POINTS";

/**
 * Can this customer redeem this reward, and if not, why not?
 *
 * One function, because the button's disabled state and the sentence
 * explaining it must never disagree. The order of the checks matters: a
 * switched-off reward is not "too expensive", and an out-of-stock one is not
 * "expired" — the customer is told the thing that is actually true.
 *
 * `balance` is the balance AT ONE SHOP. There is no parameter for a total and
 * there must not be: QueueFlow points are per business, so a combined figure
 * would authorise a redemption the shop's own account cannot pay for.
 *
 * Mirrors the order `redeem_reward()` checks in, so the UI never promises
 * something the server would refuse for a different stated reason.
 */
export function canRedeem(
  reward: RewardLike | null | undefined,
  balance: number | null | undefined,
  now: Date = new Date(),
): { ok: boolean; block: RedeemBlock | null } {
  if (!reward) return { ok: false, block: "INACTIVE" };
  if (!reward.is_active) return { ok: false, block: "INACTIVE" };
  if (reward.valid_until && new Date(reward.valid_until).getTime() < now.getTime()) {
    return { ok: false, block: "OFFER_EXPIRED" };
  }
  if (reward.stock != null && reward.stock <= 0) return { ok: false, block: "OUT_OF_STOCK" };
  if ((balance ?? 0) < reward.points_cost) return { ok: false, block: "NOT_ENOUGH_POINTS" };
  return { ok: true, block: null };
}

/**
 * How many more points this customer needs. 0 when they can already afford it.
 *
 * The one number that turns "you can't have this" into "you're 30 points
 * away", which is the difference between a dead end and a reason to come back.
 */
export function pointsShort(
  reward: Pick<RewardLike, "points_cost"> | null | undefined,
  balance: number | null | undefined,
): number {
  if (!reward) return 0;
  return Math.max(0, reward.points_cost - (balance ?? 0));
}
