import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { LoyaltyAccount, LoyaltySettings, LoyaltyTransaction } from "@/types";
import type { LoyaltySettingsFormOutput } from "../schemas/settings.schema";

/**
 * Loyalty reads and writes.
 *
 * Every read is scoped by RLS, not by the `eq()` in the query: accounts and
 * the ledger both carry `customer_id = auth.uid() or is_shop_owner(shop_id)`,
 * so a shop you don't own returns nothing with or without the filter. The
 * filters are here for the indexes.
 *
 * Every *write* to points goes through an RPC, never a table. That is not a
 * style choice — `loyalty_accounts` and `loyalty_transactions` have no INSERT
 * or UPDATE policy at all (decision 32), so a direct write is refused by the
 * database. The generated types say `Insert: never` for exactly this reason.
 */

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

/**
 * The shop's programme rules, or null if it has never been configured.
 *
 * `maybeSingle()` rather than `single()`: no row is the normal state for a
 * shop that has never touched loyalty, and decision 36 says that reads as
 * "off" everywhere rather than as an error.
 */
export async function getLoyaltySettings(shopId: string): Promise<LoyaltySettings | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("loyalty_settings")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Create or update the rules in one call.
 *
 * An upsert because the owner's first save and every later edit are the same
 * intent, and making the UI ask "does a row exist yet" would be asking it to
 * care about something only this function should know.
 */
export async function saveLoyaltySettings(
  shopId: string,
  values: LoyaltySettingsFormOutput,
): Promise<LoyaltySettings> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("loyalty_settings")
      .upsert(
        {
          shop_id: shopId,
          is_enabled: values.is_enabled,
          taka_per_point: values.taka_per_point,
          min_bill_taka: values.min_bill_taka,
        },
        { onConflict: "shop_id" },
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

// ---------------------------------------------------------------------------
// the owner's side
// ---------------------------------------------------------------------------

/** Every account at this shop, biggest balance first. */
export async function getShopLoyaltyAccounts(shopId: string): Promise<LoyaltyAccount[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("loyalty_accounts")
    .select("*")
    .eq("shop_id", shopId)
    .order("balance", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * One customer's ledger at one shop.
 *
 * Loaded only when the owner opens that customer's drawer — a shop with a
 * year of history has thousands of these rows, and the table above needs
 * none of them.
 */
export async function getLoyaltyLedger(
  shopId: string,
  customerId: string,
): Promise<LoyaltyTransaction[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

/**
 * The owner's manual correction. Returns the new balance.
 *
 * Positive or negative; the RPC refuses to take a balance below zero and
 * writes a ledger row carrying the reason either way. This is the *only*
 * way an owner can change a number by hand, which is what makes the ledger
 * a complete account of how every balance got where it is.
 */
export async function adjustLoyaltyPoints(input: {
  shopId: string;
  customerId: string;
  points: number;
  note?: string | null;
}): Promise<number> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("loyalty_adjust", {
      p_shop_id: input.shopId,
      p_customer_id: input.customerId,
      p_points: input.points,
      p_note: input.note?.trim() || null,
    });
    if (error) throw error;
    return data ?? 0;
  });
}

/**
 * The customer names behind the accounts, for the owner's table.
 *
 * `loyalty_accounts` carries only a `customer_id`, and `profiles` has no
 * cross-user read policy — so the name has to come from the shop's own work
 * rows, exactly as membership's counter-enrolment picker does. Both tables
 * are read because a salon fills `serials` and a parlour fills
 * `appointments`, and a unisex shop does both.
 */
export interface LoyaltyCustomerInfo {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
}

export async function getLoyaltyCustomerNames(
  shopId: string,
): Promise<Map<string, LoyaltyCustomerInfo>> {
  const supabase = getBrowserClient();
  const [serials, appointments] = await Promise.all([
    supabase
      .from("serials")
      .select("customer_id, customer_name, customer_phone, customer_avatar_url")
      .eq("shop_id", shopId)
      .not("customer_id", "is", null),
    supabase
      .from("appointments")
      .select("customer_id, customer_name, customer_phone, customer_avatar_url")
      .eq("shop_id", shopId)
      .not("customer_id", "is", null),
  ]);

  // One side being empty is normal, not an error — a parlour has no serials.
  if (serials.error && appointments.error) throw serials.error;

  const byId = new Map<string, LoyaltyCustomerInfo>();
  for (const row of [...(serials.data ?? []), ...(appointments.data ?? [])]) {
    if (!row.customer_id || byId.has(row.customer_id)) continue;
    byId.set(row.customer_id, {
      id: row.customer_id,
      name: row.customer_name || "",
      phone: row.customer_phone,
      avatarUrl: row.customer_avatar_url,
    });
  }
  return byId;
}

// ---------------------------------------------------------------------------
// the customer's side
// ---------------------------------------------------------------------------

export interface MyLoyaltyCard {
  shopId: string;
  shopName: string;
  shopLogoUrl: string | null;
  businessType: string;
  balance: number;
  lifetimeEarned: number;
  takaPerPoint: number;
  isEnabled: boolean;
  lastEarnedAt: string | null;
}

/**
 * The signed-in customer's point cards — one per shop, never a total.
 *
 * Through the RPC rather than a table read, because each card needs its
 * shop's name and logo and a customer cannot join `shops` to
 * `loyalty_accounts` under RLS. `auth.uid()` is hard-coded inside the
 * function, so there is no parameter through which another customer's cards
 * could be requested.
 */
export async function getMyLoyaltyCards(): Promise<MyLoyaltyCard[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("my_loyalty_accounts");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    shopId: row.shop_id,
    shopName: row.shop_name,
    shopLogoUrl: row.shop_logo_url,
    businessType: row.business_type,
    balance: row.balance,
    lifetimeEarned: row.lifetime_earned,
    takaPerPoint: row.taka_per_point,
    isEnabled: row.is_enabled,
    lastEarnedAt: row.last_earned_at,
  }));
}
