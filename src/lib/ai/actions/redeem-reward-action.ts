import "server-only";
import { translateDbError } from "@/lib/supabase/db-errors";
import type { ToolContext } from "../types";
import {
  AI_ACTION_REDEEM_REWARD,
  ProposalError,
  type RewardDraft,
} from "../proposals";
import { buildRewardDraft } from "../tools/reward-prepare";
import type { ActionExecutor, ActionOutcome, ConfirmedAction } from "./contract";

/**
 * REDEEM_REWARD — revalidate, then call the one door for spending points.
 *
 * ---------------------------------------------------------------------------
 * The concurrency story, which is the interesting part
 * ---------------------------------------------------------------------------
 * Two simultaneous redemptions must not both succeed against a balance that
 * only covers one, and nothing in this file is what prevents that. It is
 * `redeem_reward()`, and it was already correct before this sprint:
 *
 *   1. `select * from rewards where id = … and shop_id = … for update` —
 *      every redemption of the same reward serialises here;
 *   2. `select balance from loyalty_accounts where shop_id = … and
 *      customer_id = auth.uid() for update` — and every redemption by the same
 *      customer serialises here, whichever reward it is for;
 *   3. the ledger row and the balance decrement in the same transaction;
 *   4. `balance >= 0` as a CHECK, underneath all of it.
 *
 * The lock order is always reward → account, so two parallel attempts queue up
 * instead of deadlocking. The second one blocks, then re-reads the COMMITTED
 * balance and finds it short. With 500 points and two 300-point attempts,
 * exactly one succeeds — proven with genuinely parallel psql clients in
 * `run-sprint-ai4-checks.sh` (section J) rather than asserted here.
 *
 * So this sprint added no database-level fix for points concurrency, because
 * there was nothing to fix. That is worth stating plainly: "we checked and the
 * existing mechanism is sufficient" is a finding, and it is a different claim
 * from "we added a safe mechanism".
 *
 * What this sprint DID need was replay protection at the AI layer, because
 * `redeem_reward()` is deliberately not idempotent — a customer with enough
 * points may redeem the same reward twice, and that is a feature. Two
 * confirmations of ONE PROPOSAL must still produce one coupon, and
 * `ai_action_claim()`'s conditional UPDATE is what guarantees it: the row can
 * only leave PROPOSED once. No unique constraint was added to
 * `reward_redemptions`, because one would have broken the legitimate case.
 *
 * ---------------------------------------------------------------------------
 * No second loyalty calculation
 * ---------------------------------------------------------------------------
 * Nothing here computes a points deduction, writes `loyalty_transactions`,
 * updates `loyalty_accounts` or inserts into `reward_redemptions`. The coupon
 * code, the points spent and the new balance all come back from the RPC, which
 * is also the only thing that knows them.
 */

/** Map `redeem_reward`'s refusals onto this layer's vocabulary. */
function redemptionRefusal(error: unknown): ProposalError {
  const raw =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? error ?? "");
  const friendly = translateDbError(error);
  const detail = friendly.message || undefined;

  if (raw.includes("reward_insufficient_points")) {
    return new ProposalError("INSUFFICIENT_POINTS", detail);
  }
  if (raw.includes("reward_out_of_stock")) {
    return new ProposalError("REWARD_OUT_OF_STOCK", detail);
  }
  if (raw.includes("reward_offer_expired")) {
    return new ProposalError("REWARD_EXPIRED", detail);
  }
  if (raw.includes("reward_inactive")) {
    return new ProposalError("REWARD_INACTIVE", detail);
  }
  // `reward_not_found` is also what a reward belonging to ANOTHER shop
  // produces, because the RPC looks it up with `and shop_id = p_shop_id` —
  // there, a foreign reward is not forbidden, it does not exist. The
  // cross-shop case is already refused by name during revalidation, so
  // reaching here means the reward really is gone.
  if (raw.includes("reward_not_found")) {
    return new ProposalError("REWARD_NOT_FOUND", detail);
  }
  return new ProposalError("REDEMPTION_REFUSED", detail);
}

/**
 * Refuse a redemption that would cost more points than the customer agreed to.
 *
 * `points_cost` is a column the shop can edit. If it moved between the card and
 * the confirmation, deducting the new figure would be spending points the
 * customer never agreed to spend — the same objection as a changed price, and
 * the brief's §24 says the model cannot invent required points, which is
 * hollow if the server will quietly apply a different number.
 *
 * Only an INCREASE needs refusing on that reasoning, but both directions are
 * refused, because a cheaper reward is still not the offer that was accepted
 * and a fresh card costs the customer one sentence.
 */
function assertCostUnchanged(shown: RewardDraft | null, fresh: RewardDraft): void {
  if (!shown) return;
  if (shown.pointsCost !== fresh.pointsCost) {
    throw new ProposalError("PRICE_CHANGED");
  }
}

export const redeemRewardExecutor: ActionExecutor = {
  actionType: AI_ACTION_REDEEM_REWARD,

  async execute(ctx: ToolContext, action: ConfirmedAction): Promise<ActionOutcome> {
    if (!action.rewardId) throw new ProposalError("REWARD_NOT_OFFERED");

    // The SAME rules `prepare_redeem_reward` ran, from the same function: the
    // reward exists, belongs to THIS shop, is active, is not expired, is in
    // stock, and the customer's balance AT THIS SHOP covers it.
    const fresh = await buildRewardDraft(ctx, action.shopId, action.rewardId);

    assertCostUnchanged(
      action.display?.action === AI_ACTION_REDEEM_REWARD ? action.display : null,
      fresh,
    );

    // The only door for spending points. Two arguments and no customer id:
    // `auth.uid()` is hard-coded inside the function, so there is no way to
    // spend anybody else's points even from a privileged caller.
    const { data, error } = await ctx.supabase.rpc("redeem_reward", {
      p_shop_id: action.shopId,
      p_reward_id: action.rewardId,
    });

    if (error) throw redemptionRefusal(error);

    const row = (data ?? [])[0];
    // No row and no error should be impossible — the RPC returns exactly one.
    // Refusing is the safe reading: without a redemption id there is nothing to
    // settle the audit against, and reporting success for an unknown coupon is
    // the one outcome worse than a false failure.
    if (!row?.redemption_id) throw new ProposalError("REDEMPTION_REFUSED");

    return {
      resultId: row.redemption_id,
      // Every figure from the RPC's own return: the code it generated, the
      // points it actually deducted, and the balance after the deduction it
      // performed. None of it recomputed here, and none of it from the card.
      payload: {
        redemption: {
          id: row.redemption_id,
          code: row.redemption_code,
          pointsSpent: row.points_spent,
          balanceAfter: row.balance_after,
          validUntil: row.valid_until,
        },
        shop: { id: fresh.shopId, name: fresh.shopName },
        reward: {
          name: fresh.rewardName,
          kind: fresh.rewardKind,
          value: fresh.rewardValue,
          freeService: fresh.freeServiceName,
        },
      },
    };
  },

  /**
   * Deliberately never heals, and the reason is worth writing down.
   *
   * A coupon carries no reference back to the proposal that caused it —
   * `reward_redemptions` has no `ai_action_id`, and adding one would mean
   * `redeem_reward()` taking an AI-specific argument, which is how a shared
   * business function starts serving one caller.
   *
   * So identifying "the coupon this CONFIRMED row created" could only be a
   * guess: the customer's most recent ISSUED coupon for that reward, issued
   * after `confirmed_at`. That guess is wrong whenever they also redeemed the
   * same reward from the rewards screen in the same minute, and being wrong
   * here does real damage — `ai_actions_one_per_redemption_idx` would then
   * attach that coupon permanently to this audit row and refuse the real one.
   *
   * A gap in an audit trail is honest. A plausible wrong answer is not. So a
   * lost settle leaves the row CONFIRMED: the coupon exists, the points are
   * spent, and both are visible on the customer's own coupons screen — the
   * record of WHY is what is missing, and the confirm endpoint reports it as a
   * failure the customer can check rather than as a success.
   *
   * The returning-null branch is reached only for a CONFIRMED row. An already
   * EXECUTED one is answered from its own `redemption_id` by the route, before
   * any executor is consulted.
   */
  async reconcile(): Promise<ActionOutcome | null> {
    return null;
  },
};
