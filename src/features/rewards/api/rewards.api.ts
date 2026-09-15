import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { RedemptionStatus, Reward, RewardKind, RewardRedemption } from "@/types";
import type { RewardFormOutput } from "../schemas/reward.schema";

/**
 * Reward reads and writes.
 *
 * The catalogue is an ordinary table the owner writes through RLS, exactly as
 * `membership_tiers` is. **Redemptions are not.** `reward_redemptions` has no
 * INSERT, UPDATE or DELETE policy at all, so every write goes through an RPC —
 * and the generated types say `Insert: never` for that reason. A coupon is
 * issued only inside `redeem_reward()`, consumed only inside
 * `mark_redemption_used()`, expired only by `expire_redemptions()`.
 *
 * Nothing here decrements a points balance. `redeem_reward()` does that, in
 * the same transaction as the ledger row, so the balance can never drift from
 * the ledger (the Sprint 7 invariant).
 */

// ---------------------------------------------------------------------------
// the owner's catalogue
// ---------------------------------------------------------------------------

/** Every reward at this shop, switched-off ones included. */
export async function getShopRewards(shopId: string): Promise<Reward[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .eq("shop_id", shopId)
    .order("sort_order")
    .order("points_cost");

  if (error) throw error;
  return data ?? [];
}

/**
 * Active rewards only — what a customer sees on a shop page.
 *
 * The `eq("is_active", true)` is for the index, not for safety: the "browse
 * active" RLS policy already hides the rest from anyone who is not the owner.
 */
export async function getPublicRewards(shopId: string): Promise<Reward[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order")
    .order("points_cost");

  if (error) throw error;
  return data ?? [];
}

/**
 * Turn the form's output into a row.
 *
 * The per-kind nulling happens here rather than in the form, because
 * `rewards_value_matches_kind` is absolute: a DISCOUNT_FLAT with a
 * `service_id` is refused outright, even if the owner only left it there by
 * switching the kind after choosing a service.
 */
function toRow(values: RewardFormOutput) {
  const free = values.kind === "FREE_SERVICE";
  return {
    name: values.name,
    description: values.description?.trim() || null,
    kind: values.kind as RewardKind,
    points_cost: values.points_cost,
    value: free ? null : (values.value ?? null),
    service_id: free ? (values.service_id ?? null) : null,
    stock: values.stock ?? null,
    valid_until: values.valid_until || null,
    is_active: values.is_active,
    sort_order: values.sort_order,
  };
}

export async function createReward(
  shopId: string,
  values: RewardFormOutput,
): Promise<Reward> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("rewards")
      .insert({ shop_id: shopId, ...toRow(values) })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/**
 * Edit a reward. `shop_id` is not sent and could not be honoured if it were —
 * `rewards_before_write()` freezes it, so a reward can never be moved to
 * another shop.
 */
export async function updateReward(
  rewardId: string,
  values: RewardFormOutput,
): Promise<Reward> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("rewards")
      .update(toRow(values))
      .eq("id", rewardId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/** The one-tap switch on each catalogue row. */
export async function setRewardActive(rewardId: string, isActive: boolean): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase
      .from("rewards")
      .update({ is_active: isActive })
      .eq("id", rewardId);

    if (error) throw error;
  });
}

// ---------------------------------------------------------------------------
// the owner's redemptions
// ---------------------------------------------------------------------------

/** Every coupon issued at this shop, newest first. */
export async function getShopRedemptions(shopId: string): Promise<RewardRedemption[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("*")
    .eq("shop_id", shopId)
    .order("issued_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

/**
 * Find one coupon by its code, for the verification sheet.
 *
 * A plain table read, deliberately: RLS already narrows it to this shop, and
 * looking a code up must not *consume* it — the owner needs to see who it
 * belongs to and what it is worth before choosing a booking. Consuming is a
 * separate, explicit call.
 *
 * `(shop_id, code)` is the unique index, so another shop's code simply is not
 * here — the same isolation `mark_redemption_used()` enforces server-side.
 */
export async function findRedemptionByCode(
  shopId: string,
  code: string,
): Promise<RewardRedemption | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("*")
    .eq("shop_id", shopId)
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export interface OpenBooking {
  id: string;
  type: "SERIAL" | "APPOINTMENT";
  label: string;
  totalAmount: number;
  at: string;
}

/**
 * The customer's still-open jobs at this shop, so the owner picks one rather
 * than typing an id.
 *
 * Both tables are read because a salon fills `serials` and a parlour fills
 * `appointments`, and a unisex shop does both — the same reason
 * `getLoyaltyCustomerNames()` reads both. Finished and cancelled jobs are
 * excluded: a coupon has to be applied before the bill is closed, because the
 * discount lands as the job reaches DONE.
 */
export async function getOpenBookingsForCustomer(
  shopId: string,
  customerId: string,
): Promise<OpenBooking[]> {
  const supabase = getBrowserClient();

  // The two status lists are written out per table rather than shared, because
  // they are different unions: a serial is never BOOKED and an appointment is
  // never WAITING.
  const [serials, appointments] = await Promise.all([
    supabase
      .from("serials")
      .select("id, total_amount, booked_at, status")
      .eq("shop_id", shopId)
      .eq("customer_id", customerId)
      .in("status", ["WAITING", "IN_PROGRESS"]),
    supabase
      .from("appointments")
      .select("id, total_amount, starts_at, status")
      .eq("shop_id", shopId)
      .eq("customer_id", customerId)
      .in("status", ["BOOKED", "CONFIRMED", "IN_PROGRESS"]),
  ]);

  // One side being empty is normal, not an error — a parlour has no serials.
  if (serials.error && appointments.error) throw serials.error;

  const rows: OpenBooking[] = [
    ...(serials.data ?? []).map((row) => ({
      id: row.id,
      type: "SERIAL" as const,
      label: row.status,
      totalAmount: row.total_amount,
      at: row.booked_at,
    })),
    ...(appointments.data ?? []).map((row) => ({
      id: row.id,
      type: "APPOINTMENT" as const,
      label: row.status,
      totalAmount: row.total_amount,
      at: row.starts_at,
    })),
  ];

  return rows.sort((a, b) => a.at.localeCompare(b.at));
}

export interface MarkUsedResult {
  redemptionId: string;
  rewardName: string;
  discountAmount: number;
  billBefore: number;
  billAfter: number;
}

/**
 * Consume a coupon against one booking. Owner-only, server-enforced.
 *
 * This records the discount on the redemption; it does **not** write the
 * booking's bill. The `zz_reward_discount` trigger subtracts it as the job
 * reaches DONE — which is what lets a parlour appointment honour a discount
 * even though `appointment_before_update()` freezes its `total_amount`.
 */
export async function markRedemptionUsed(input: {
  shopId: string;
  code: string;
  bookingType: "SERIAL" | "APPOINTMENT";
  bookingId: string;
}): Promise<MarkUsedResult> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("mark_redemption_used", {
      p_shop_id: input.shopId,
      p_code: input.code.trim().toUpperCase(),
      p_booking_type: input.bookingType,
      p_booking_id: input.bookingId,
    });
    if (error) throw error;

    const row = (data ?? [])[0];
    return {
      redemptionId: row?.redemption_id ?? "",
      rewardName: row?.reward_name ?? "",
      discountAmount: row?.discount_amount ?? 0,
      billBefore: row?.bill_before ?? 0,
      billAfter: row?.bill_after ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// the customer's side
// ---------------------------------------------------------------------------

export interface RedeemResult {
  redemptionId: string;
  code: string;
  pointsSpent: number;
  balanceAfter: number;
  validUntil: string | null;
}

/**
 * Spend points on a reward. The whole thing is one transaction server-side.
 *
 * **No balance check happens here.** Reading the balance in the browser and
 * then inserting would be race-prone — two taps could each see enough points
 * and both spend them. `redeem_reward()` locks the reward row and then the
 * account row, in that order, and the `balance >= 0` CHECK sits underneath as
 * the last backstop. The client's job is to ask and to render the answer.
 *
 * The UI still calls `canRedeem()` first, but only to avoid a pointless round
 * trip and to explain *why* a button is disabled — never as the guarantee.
 */
export async function redeemReward(
  shopId: string,
  rewardId: string,
): Promise<RedeemResult> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("redeem_reward", {
      p_shop_id: shopId,
      p_reward_id: rewardId,
    });
    if (error) throw error;

    const row = (data ?? [])[0];
    return {
      redemptionId: row?.redemption_id ?? "",
      code: row?.redemption_code ?? "",
      pointsSpent: row?.points_spent ?? 0,
      balanceAfter: row?.balance_after ?? 0,
      validUntil: row?.valid_until ?? null,
    };
  });
}

export interface MyCoupon {
  id: string;
  shopId: string;
  shopName: string;
  shopLogoUrl: string | null;
  rewardName: string;
  rewardKind: string;
  code: string;
  status: RedemptionStatus;
  pointsSpent: number;
  discountAmount: number | null;
  issuedAt: string;
  usedAt: string | null;
  expiresAt: string | null;
}

/**
 * The signed-in customer's coupons, across every shop.
 *
 * Through the RPC rather than a table read, because each coupon needs its
 * shop's name and logo and a customer cannot join `shops` to
 * `reward_redemptions` under RLS. `auth.uid()` is hard-coded inside the
 * function, so there is no parameter through which another customer's coupons
 * could be requested.
 */
export async function getMyCoupons(): Promise<MyCoupon[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("my_redemptions");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    shopId: row.shop_id,
    shopName: row.shop_name,
    shopLogoUrl: row.shop_logo_url,
    rewardName: row.reward_name,
    rewardKind: row.reward_kind,
    code: row.redemption_code,
    status: row.status,
    pointsSpent: row.points_spent,
    discountAmount: row.discount_amount,
    issuedAt: row.issued_at,
    usedAt: row.used_at,
    expiresAt: row.expires_at,
  }));
}

/**
 * This customer's point balance at one shop — never a total across shops.
 *
 * Read straight off `loyalty_accounts`: the customer's own RLS policy already
 * narrows it to their row, so no RPC is needed. Returns 0 rather than null for
 * a customer with no account yet, because "no points here" and "no row here"
 * mean the same thing to every screen that asks.
 */
export async function getMyBalanceAtShop(shopId: string): Promise<number> {
  const supabase = getBrowserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;

  const { data, error } = await supabase
    .from("loyalty_accounts")
    .select("balance")
    .eq("shop_id", shopId)
    .eq("customer_id", auth.user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.balance ?? 0;
}
