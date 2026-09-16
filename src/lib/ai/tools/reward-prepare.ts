import "server-only";
import { z } from "zod";
import { canRedeem, type RewardLike } from "@/lib/reward-eligibility";
import type { DiscoveryLedgerLike, ToolContext, ToolDefinition } from "../types";
import {
  AI_ACTION_REDEEM_REWARD,
  ProposalError,
  type ProposalRefusal,
  type RewardDraft,
} from "../proposals";

/**
 * The customer's reward tools: one to look, one to prepare.
 *
 * ---------------------------------------------------------------------------
 * Loyalty is per business, and that is the whole design of this file
 * ---------------------------------------------------------------------------
 * QueueFlow points belong to a `(shop_id, customer_id)` pair — `loyalty_accounts`
 * has that as its PRIMARY KEY, and decision 33 spells out why: 50 points buys
 * something at one shop and nothing at another, so a total across shops is not
 * a useful number, it is a misleading one.
 *
 * The consequence for an assistant is sharper than for a screen. A screen shows
 * a list and the customer reads it; an assistant is asked "how many points do I
 * have?" and has to answer in a sentence. So:
 *
 *   · `get_my_rewards` returns a LIST keyed by shop and no total anywhere. There
 *     is no field to sum, and the tool says so in its own payload, because the
 *     model is perfectly capable of adding two numbers it was handed and
 *     announcing the result;
 *   · `RewardDraft.balance` is the balance at ONE shop, read from that shop's
 *     own row;
 *   · `canRedeem` takes a single balance and has no parameter for a combined
 *     one, so there is no way to express the wrong question.
 *
 * And underneath all of that, `redeem_reward()` reads
 * `loyalty_accounts where shop_id = p_shop_id and customer_id = auth.uid()`
 * with the row locked. If every line of this file were wrong, points from one
 * shop still could not pay for a reward at another.
 *
 * ---------------------------------------------------------------------------
 * No second eligibility implementation
 * ---------------------------------------------------------------------------
 * `canRedeem` is imported from `@/lib/reward-eligibility` — the same function
 * the redemption button uses, promoted out of the rewards feature in this
 * sprint precisely so there would be one copy. Its check order mirrors
 * `redeem_reward()`'s, so a reason the assistant gives is a reason the server
 * would also have given.
 *
 * ---------------------------------------------------------------------------
 * And no second redemption path
 * ---------------------------------------------------------------------------
 * `redeem_reward(p_shop_id, p_reward_id)` already exists and is already a safe
 * standalone customer capability: SECURITY DEFINER with `auth.uid()`
 * hard-coded, one transaction covering the balance check, the stock decrement,
 * the coupon, the ledger row and the new balance, locking the reward row and
 * then the account row in that fixed order. The executor calls it. Nothing in
 * the AI layer computes a points deduction, writes `loyalty_transactions` or
 * touches `reward_redemptions`.
 */

/** A handful of shops, not the customer's whole history. */
const MAX_REWARD_SHOPS = 5;
/** And a handful of rewards each — a catalogue, not a data dump. */
const MAX_REWARDS_PER_SHOP = 8;

/** `canRedeem`'s reasons, in this layer's vocabulary. */
const REFUSAL_FOR_BLOCK: Record<string, ProposalRefusal> = {
  INACTIVE: "REWARD_INACTIVE",
  OFFER_EXPIRED: "REWARD_EXPIRED",
  OUT_OF_STOCK: "REWARD_OUT_OF_STOCK",
  NOT_ENOUGH_POINTS: "INSUFFICIENT_POINTS",
};

/**
 * The customer's points at ONE shop.
 *
 * Read straight off `loyalty_accounts`: the customer's own SELECT policy
 * narrows it to their row, and the `customer_id` filter is belt to that brace —
 * `ctx.userId` came from `auth.getUser()` and there is no argument through
 * which a caller could name anybody else.
 *
 * A missing row is NO_LOYALTY_ACCOUNT rather than a balance of zero, and the
 * distinction is worth keeping: "you have not collected points here yet" is a
 * different sentence from "you are 300 points short", and only one of them
 * tells the customer what to do about it.
 */
export async function readShopBalance(
  ctx: ToolContext,
  shopId: string,
): Promise<number> {
  const { data, error } = await ctx.supabase
    .from("loyalty_accounts")
    .select("balance")
    .eq("shop_id", shopId)
    .eq("customer_id", ctx.userId)
    .maybeSingle();

  if (error) throw new ProposalError("UNAVAILABLE");
  if (!data) throw new ProposalError("NO_LOYALTY_ACCOUNT");
  return data.balance;
}

/**
 * Read one reward and refuse anything not redeemable at this shop.
 *
 * The `shop_id` comparison is the business-isolation check, and it is the one
 * that earns its own refusal code: a reward that belongs to another shop is not
 * "unavailable", it is a category error, and the customer should be told which.
 * `redeem_reward()` makes the same check by selecting
 * `where id = p_reward_id and shop_id = p_shop_id` — there another shop's
 * reward is not forbidden but non-existent, which is the stronger form.
 *
 * Note what RLS already does here. The "rewards: browse active" policy shows a
 * customer only active rewards of ACTIVE shops, so a switched-off reward is
 * usually invisible and comes back as REWARD_NOT_FOUND. The explicit
 * `is_active` check below still matters: the owner policy is `for all`, so a
 * shopkeeper reading their own shop's catalogue does see inactive rows, and a
 * refusal should not depend on which policy happened to apply.
 */
export async function loadRedeemableReward(
  ctx: ToolContext,
  shopId: string,
  rewardId: string,
) {
  const { data: reward, error } = await ctx.supabase
    .from("rewards")
    .select(
      "id, shop_id, name, description, kind, points_cost, value, service_id, stock, valid_until, is_active",
    )
    .eq("id", rewardId)
    .maybeSingle();

  if (error) throw new ProposalError("UNAVAILABLE");
  if (!reward) throw new ProposalError("REWARD_NOT_FOUND");
  if (reward.shop_id !== shopId) throw new ProposalError("REWARD_WRONG_SHOP");
  if (!reward.is_active) throw new ProposalError("REWARD_INACTIVE");

  return reward;
}

/** Build the whole draft. Shared with the confirm endpoint's revalidation. */
export async function buildRewardDraft(
  ctx: ToolContext,
  shopId: string,
  rewardId: string,
): Promise<RewardDraft> {
  const { data: shop, error: shopError } = await ctx.supabase
    .from("shops")
    .select("id, name")
    .eq("id", shopId)
    .maybeSingle();

  if (shopError) throw new ProposalError("UNAVAILABLE");
  if (!shop) throw new ProposalError("SHOP_NOT_FOUND");

  const reward = await loadRedeemableReward(ctx, shopId, rewardId);
  const balance = await readShopBalance(ctx, shopId);

  // The shared rule, with the shop's OWN balance. Its check order matches
  // `redeem_reward()`'s, so the reason given here is the reason the server
  // would give: a switched-off reward is not "too expensive", and an
  // out-of-stock one is not "expired".
  const verdict = canRedeem(reward as RewardLike, balance, ctx.now);
  if (!verdict.ok) {
    throw new ProposalError(
      REFUSAL_FOR_BLOCK[verdict.block ?? ""] ?? "UNAVAILABLE",
    );
  }

  // FREE_SERVICE names a service, and a card that said "Free service" without
  // saying which one would be asking the customer to agree to something
  // undescribed. Best-effort: a name we cannot read becomes null, and the card
  // falls back to the reward's own name rather than inventing a service.
  let freeServiceName: string | null = null;
  if (reward.service_id) {
    const { data: service } = await ctx.supabase
      .from("services")
      .select("id, name")
      .eq("id", reward.service_id)
      .maybeSingle();
    freeServiceName = service?.name ?? null;
  }

  return {
    action: AI_ACTION_REDEEM_REWARD,
    shopId: shop.id,
    shopName: shop.name,
    rewardId: reward.id,
    rewardName: reward.name,
    rewardDescription: reward.description ?? null,
    rewardKind: reward.kind,
    rewardValue: reward.value ?? null,
    freeServiceName,
    // From `rewards.points_cost`. There is no argument through which a caller
    // could supply a cost, and `redeem_reward()` deducts `r.points_cost` read
    // inside its own locked transaction — so the number on the card and the
    // number deducted both come from the row, never from the model.
    pointsCost: reward.points_cost,
    balance,
    balanceAfter: balance - reward.points_cost,
    validUntil: reward.valid_until ?? null,
  };
}

// ---------------------------------------------------------------------------
// The tools
// ---------------------------------------------------------------------------

const getMyRewards: ToolDefinition = {
  name: "get_my_rewards",
  description:
    "The signed-in customer's OWN loyalty points and the rewards they could spend them on, listed PER SHOP. " +
    "Use for 'what rewards do I have', 'how many points do I have', 'can I get a discount at this shop'. " +
    "Points are per business: a balance at one shop buys nothing at another, so never add balances together and never quote a combined total. Read-only.",
  readOnly: true,
  roles: ["customer"],
  // Deliberately no customer id. There is no argument through which the model
  // could name somebody else, which is a stronger guarantee than validating one
  // would have been.
  schema: z.object({
    shopId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Optional: just one shop's card and catalogue. Omit to list every shop where the customer has points.",
      ),
  }),
  handler: async (args, ctx) => {
    const { shopId } = args as { shopId?: string };

    // `my_loyalty_accounts()` — the existing RPC, with `auth.uid()` hard-coded
    // inside it. One row per shop, ordered by balance, each carrying its shop's
    // name so "where do these points work" is never a question. There is no
    // second loyalty calculation here and there must not be.
    const { data, error } = await ctx.supabase.rpc("my_loyalty_accounts");
    if (error) throw error;

    const accounts = (data ?? [])
      .filter((row) => !shopId || row.shop_id === shopId)
      .slice(0, MAX_REWARD_SHOPS);

    if (accounts.length === 0) {
      return {
        shops: [],
        // Distinguishable from "I could not read it", which the prompt requires.
        hasPoints: false,
        note: "This customer has no points card at any shop yet (or none at the shop asked about).",
      };
    }

    // One batched read for the catalogues, not one query per shop. RLS's
    // "browse active" policy narrows these to active rewards of active shops.
    const shopIds = accounts.map((row) => row.shop_id);
    const { data: rewardRows, error: rewardsError } = await ctx.supabase
      .from("rewards")
      .select(
        "id, shop_id, name, description, kind, points_cost, value, service_id, stock, valid_until, is_active",
      )
      .in("shop_id", shopIds)
      .eq("is_active", true)
      .order("sort_order")
      .order("points_cost");
    if (rewardsError) throw rewardsError;

    const byShop = new Map<string, typeof rewardRows>();
    for (const row of rewardRows ?? []) {
      const list = byShop.get(row.shop_id) ?? [];
      list.push(row);
      byShop.set(row.shop_id, list);
    }

    const shops = accounts.map((account) => {
      const catalogue = (byShop.get(account.shop_id) ?? []).slice(
        0,
        MAX_REWARDS_PER_SHOP,
      );
      return {
        shop_id: account.shop_id,
        shop_name: account.shop_name,
        business_type: account.business_type,
        // THIS shop's balance. The name says so, and there is no sibling field
        // holding a total.
        points_balance_at_this_shop: account.balance,
        lifetime_earned_at_this_shop: account.lifetime_earned,
        loyalty_enabled: account.is_enabled,
        rewards: catalogue.map((reward) => {
          // The shared rule, against THIS shop's balance.
          const verdict = canRedeem(reward as RewardLike, account.balance, ctx.now);
          return {
            reward_id: reward.id,
            name: reward.name,
            description: reward.description,
            kind: reward.kind,
            // Straight from the row. The model cannot choose or round these.
            value: reward.value,
            points_cost: reward.points_cost,
            valid_until: reward.valid_until,
            can_redeem_now: verdict.ok,
            blocked_because: verdict.block,
            points_short: Math.max(0, reward.points_cost - account.balance),
          };
        }),
      };
    });

    // Record what was actually returned. This is the ONLY way a reward id
    // becomes proposable — `prepare_redeem_reward` checks against this ledger
    // before it queries anything, so a reward the model invented, remembered
    // from an earlier turn, or read out of a shop's own description text cannot
    // reach the confirm path.
    ctx.discovery?.offer(
      "reward",
      shops.flatMap((shop) => shop.rewards.map((reward) => reward.reward_id)),
    );
    // The shop ids are offered too, and that is a considered difference from
    // `get_queue_status`, which does not offer the ids it was given. There, the
    // shop ids came FROM the model, so echoing them back would let a guessed
    // uuid launder itself into proposable. Here they came from
    // `my_loyalty_accounts()` — the customer's own points cards, chosen by the
    // RPC. An optional `shopId` only FILTERS that list, so a guessed id appears
    // below solely if this customer genuinely holds points there, which is a
    // verification rather than an echo.
    ctx.discovery?.offer(
      "shop",
      shops.map((shop) => shop.shop_id),
    );

    return {
      shops,
      hasPoints: true,
      shops_returned: shops.length,
      note:
        "Each balance belongs to ONE shop and they cannot be combined. " +
        "Never state a total across shops, and never offer a reward at a shop other than the one whose points pay for it. " +
        "To offer a redemption, call prepare_redeem_reward with a reward_id and its own shop_id from this list.",
    };
  },
};

const ArgsSchema = z.object({
  shopId: z
    .string()
    .uuid()
    .describe(
      "The shop whose points pay for this reward, from a get_my_rewards result in THIS turn. It must be the reward's own shop.",
    ),
  rewardId: z
    .string()
    .uuid()
    .describe(
      "The reward id from a get_my_rewards result in THIS turn. An id you were not given will be rejected.",
    ),
});

const prepareRedeemReward: ToolDefinition<typeof ArgsSchema> = {
  name: "prepare_redeem_reward",
  description:
    "Prepare a reward redemption for the customer to confirm. This does NOT spend any points and does NOT issue a coupon — it re-checks the reward and the customer's balance AT THAT SHOP and produces a confirmation card the customer must approve themselves. " +
    "Call get_my_rewards first in this same turn and use the reward_id with its own shop_id. Points are per business: a reward can only be paid for with points from its own shop. " +
    "After calling this, tell the customer what is on the card and that they need to confirm it. Never say the points have been spent or give them a coupon code.",
  readOnly: true,
  roles: ["customer"],
  schema: ArgsSchema,
  handler: async (args, ctx) => {
    const ledger = ctx.discovery as DiscoveryLedgerLike | undefined;
    if (!ledger) throw new ProposalError("REWARD_NOT_OFFERED");

    // BEFORE any query: were these actually offered this request?
    ledger.requireOffered("shop", [args.shopId]);
    ledger.requireOffered("reward", [args.rewardId]);

    const draft = await buildRewardDraft(ctx, args.shopId, args.rewardId);
    ledger.draft = draft;

    return {
      prepared: true,
      shop: { id: draft.shopId, name: draft.shopName },
      reward: {
        name: draft.rewardName,
        description: draft.rewardDescription,
        kind: draft.rewardKind,
        value: draft.rewardValue,
        free_service: draft.freeServiceName,
      },
      points_cost: draft.pointsCost,
      // Named to make the scope unmistakable in the model's context window.
      balance_at_this_shop: draft.balance,
      balance_after_at_this_shop: draft.balanceAfter,
      valid_until: draft.validUntil,
      note:
        "NO POINTS HAVE BEEN SPENT and no coupon exists. A confirmation card is now shown to the customer. " +
        "They must press confirm themselves. Tell them what it says and ask them to confirm — " +
        "do not say the reward is redeemed and do not invent a coupon code. " +
        "The coupon is shown to the shop at the counter; redeeming it does not by itself discount anything.",
    };
  },
};

export const REWARD_TOOLS: readonly ToolDefinition[] = [
  getMyRewards,
  prepareRedeemReward,
];
