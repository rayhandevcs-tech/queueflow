import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { LoyaltySettings, Referral, ReferralStatus } from "@/types";
import type { ReferralSettingsFormOutput } from "../schemas/referral-settings.schema";

/**
 * Referral reads and writes.
 *
 * Every write goes through an RPC, never a table — and that is not a style
 * choice. `referral_codes` and `referrals` have no INSERT, UPDATE or DELETE
 * policy at all, so a direct write is refused by the database; the generated
 * types say `Insert: never` for exactly that reason.
 *
 * The rules live on `loyalty_settings` rather than a table of their own,
 * because a referral reward *is* a loyalty point. That means saving them is
 * an update to a row loyalty also owns — hence the read-modify-write below,
 * rather than an upsert that would blank loyalty's own columns.
 */

// ---------------------------------------------------------------------------
// the owner's side
// ---------------------------------------------------------------------------

/**
 * Save the referral half of the shop's programme rules.
 *
 * An UPDATE, not an upsert: a shop can only reach this form once loyalty is
 * on, which means the row already exists. Upserting would need loyalty's
 * three columns too, and sending a stale copy of them from this form is
 * exactly how a rate gets silently reset.
 */
export async function saveReferralSettings(
  shopId: string,
  values: ReferralSettingsFormOutput,
): Promise<LoyaltySettings> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("loyalty_settings")
      .update({
        referral_enabled: values.referral_enabled,
        referral_referrer_points: values.referral_referrer_points,
        referral_referred_points: values.referral_referred_points,
      })
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

export interface ReferrerStatsRow {
  referrerId: string;
  referrerName: string;
  code: string;
  totalReferrals: number;
  convertedCount: number;
  pendingCount: number;
  pointsAwarded: number;
  lastReferralAt: string | null;
}

/**
 * Who brought how many, for this shop.
 *
 * Through an RPC rather than a table read because each row needs the
 * referrer's name, and `profiles` has no cross-user read policy — the same
 * wall loyalty's member table hit. The function's first line is
 * `is_shop_owner(p_shop_id)`, and there is no variant without a shop, so
 * there is no shape of this call that could return another shop's numbers.
 */
export async function getShopReferralStats(shopId: string): Promise<ReferrerStatsRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_referral_stats", { p_shop_id: shopId });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    referrerId: row.referrer_id,
    referrerName: row.referrer_name,
    code: row.code,
    totalReferrals: row.total_referrals,
    convertedCount: row.converted_count,
    pendingCount: row.pending_count,
    pointsAwarded: row.points_awarded,
    lastReferralAt: row.last_referral_at,
  }));
}

// ---------------------------------------------------------------------------
// the customer's side
// ---------------------------------------------------------------------------

/*
 * There is no `getReferralIsLive()` here on purpose. "Is referral live" is
 * `is_enabled && referral_enabled` on the shop's `loyalty_settings` row, and
 * a customer can already read that row at an enabled shop (loyalty's "browse
 * enabled" policy) — so the question is answered by `isReferralLive()` in
 * `lib/referral.ts` without a second round trip. When loyalty is off the row
 * is unreadable, which reads as null, which reads as not live: the right
 * answer by the same path.
 *
 * The `referral_is_live()` SQL function still exists and still matters — it
 * is what `my_referral_code`, `claim_referral` and the conversion trigger
 * each check, so the rule has exactly one home on the side that enforces it.
 */

/**
 * The signed-in customer's code at this shop, minted on first ask.
 *
 * A mutation in disguise — the first call writes a row — so it is never
 * called from a plain query on page load. The customer taps "get my code",
 * because a code nobody asked for is a row nobody needed.
 */
export async function mintMyReferralCode(shopId: string): Promise<string> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("my_referral_code", { p_shop_id: shopId });
    if (error) throw error;
    return data ?? "";
  });
}

/**
 * The code this customer already has here, or null.
 *
 * A table read rather than the RPC, precisely because it must *not* mint one:
 * the share card has to be able to ask "do I have a code" without creating
 * the answer. RLS narrows it to their own row.
 */
export async function getMyReferralCode(shopId: string): Promise<string | null> {
  const supabase = getBrowserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("shop_id", shopId)
    .eq("customer_id", auth.user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.code ?? null;
}

export interface MyReferralRow {
  id: string;
  referredName: string;
  status: ReferralStatus;
  pointsEarned: number;
  convertedAt: string | null;
  createdAt: string;
}

/**
 * The customer's own referrals at this shop.
 *
 * Through the RPC because the list is worth nothing without a name, and
 * `profiles` is unreadable across users. The function hard-codes
 * `referrer_id = auth.uid()`, so there is no parameter through which someone
 * else's referrals could be requested, and it shortens the name to its first
 * word — the referrer needs to know someone came, not their full identity.
 */
export async function getMyReferrals(shopId: string): Promise<MyReferralRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("my_referrals", { p_shop_id: shopId });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    referredName: row.referred_name,
    status: row.status,
    pointsEarned: row.points_earned,
    convertedAt: row.converted_at,
    createdAt: row.created_at,
  }));
}

/**
 * Enter someone else's code. Returns the new referral's id.
 *
 * **This awards nothing.** It records a PENDING relationship; the points land
 * only when the customer actually completes a booking here. That split is the
 * whole point of the feature — otherwise typing a code would be the reward.
 */
export async function claimReferral(shopId: string, code: string): Promise<string> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("claim_referral", {
      p_shop_id: shopId,
      p_code: code.trim().toUpperCase(),
    });
    if (error) throw error;
    return data ?? "";
  });
}

/**
 * The referral this customer arrived on at this shop, if any.
 *
 * Read straight off the table: the RLS policy already narrows it to rows
 * they are party to, so `referred_id = auth.uid()` needs no RPC. Used to
 * replace the claim form with "code applied" rather than letting someone
 * enter a second one and be refused.
 */
export async function getMyClaimedReferral(shopId: string): Promise<Referral | null> {
  const supabase = getBrowserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("shop_id", shopId)
    .eq("referred_id", auth.user.id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

// ---------------------------------------------------------------------------
// across every shop — the customer's own referral page (Sprint 11)
// ---------------------------------------------------------------------------

export interface MyReferralShop {
  shopId: string;
  shopName: string;
  shopLogoUrl: string | null;
  code: string;
  referrerPoints: number;
  referredPoints: number;
}

/**
 * Every shop where this customer already holds a code.
 *
 * Three narrow reads rather than one join, because each answers to a different
 * policy and PostgREST would need an FK relationship this schema does not
 * declare between `referral_codes` and `loyalty_settings`:
 *
 *   · `referral_codes` — `customer_id = auth.uid()` is one half of its only
 *     SELECT policy, so this returns exactly the caller's own rows and no
 *     `customer_id` filter in JavaScript is load-bearing.
 *   · `shops` — for the name and logo, so a code is never shown as a bare
 *     UUID.
 *   · `loyalty_settings` — for the two point values, readable by a customer
 *     only for active shops whose programme is on ("browse enabled").
 *
 * A shop whose programme has since been switched off drops out here rather
 * than being listed with invented rewards: the settings row is unreadable, so
 * there is nothing honest to print next to the code.
 *
 * It deliberately does NOT mint anything. A customer gets a code by asking for
 * it on a shop's own page; this page shows the ones that exist.
 */
export async function getMyReferralShops(): Promise<MyReferralShop[]> {
  const supabase = getBrowserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data: codes, error } = await supabase
    .from("referral_codes")
    .select("shop_id, code, created_at")
    .eq("customer_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = codes ?? [];
  if (rows.length === 0) return [];

  const shopIds = [...new Set(rows.map((row) => row.shop_id))];

  const [shopsResult, settingsResult] = await Promise.all([
    supabase.from("shops").select("id, name, logo_url").in("id", shopIds),
    supabase
      .from("loyalty_settings")
      .select("shop_id, referral_enabled, referral_referrer_points, referral_referred_points")
      .in("shop_id", shopIds),
  ]);

  const shopById = new Map((shopsResult.data ?? []).map((shop) => [shop.id, shop]));
  const settingsByShop = new Map((settingsResult.data ?? []).map((row) => [row.shop_id, row]));

  return rows.flatMap((row) => {
    const shop = shopById.get(row.shop_id);
    const settings = settingsByShop.get(row.shop_id);
    // No shop (deleted/suspended) or no readable, switched-on programme means
    // there is nothing truthful to show for this code.
    if (!shop || !settings?.referral_enabled) return [];
    return [
      {
        shopId: row.shop_id,
        shopName: shop.name,
        shopLogoUrl: shop.logo_url,
        code: row.code,
        referrerPoints: settings.referral_referrer_points ?? 0,
        referredPoints: settings.referral_referred_points ?? 0,
      },
    ];
  });
}
