import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildShopBrief, type ShopBrief } from "../lib/build-shop-brief";

/** Nobody is signed in, or the signed-in account owns no shop. */
export const NO_SHOP = "NO_SHOP";

/**
 * A rolling six months. Long enough to see a seasonal swing and a trend across
 * several months; short enough that the brief stays small, which matters
 * because it is re-sent (and cached) on every chat turn.
 */
function since(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Read the caller's own shop and reduce it to a brief.
 *
 * Everything here goes through the cookie-bound Supabase client, so RLS is what
 * enforces ownership — not a `where owner_id = ...` we could forget. The
 * service-role client is deliberately not used: this runs on behalf of one
 * shopkeeper looking at their own numbers, and there is no reason to hand that
 * request a key that can read every shop on the platform.
 */
export async function gatherShopBrief(): Promise<ShopBrief> {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(NO_SHOP);

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, business_type")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!shop) throw new Error(NO_SHOP);

  const from = since();

  const [serials, manualEntries, expenses, reviews, chairs, services] = await Promise.all([
    supabase
      .from("serials")
      .select(
        "completed_at, created_at, total_amount, payment_status, status, chair_id, customer_id, services_snapshot",
      )
      .eq("shop_id", shop.id)
      .gte("created_at", from),
    supabase
      .from("manual_entries")
      .select("created_at, amount, payment_status")
      .eq("shop_id", shop.id)
      .gte("created_at", from),
    supabase
      .from("shop_expenses")
      .select("spent_on, amount, category")
      .eq("shop_id", shop.id)
      .gte("spent_on", from.slice(0, 10)),
    supabase
      .from("reviews")
      .select("rating, comment, created_at")
      .eq("shop_id", shop.id)
      .is("hidden_at", null)
      .gte("created_at", from),
    supabase.from("chairs").select("id, label, staff_name, is_active").eq("shop_id", shop.id),
    supabase
      .from("services")
      .select("name, rate, default_duration_min, is_active")
      .eq("shop_id", shop.id),
  ]);

  return buildShopBrief({
    shopName: shop.name,
    businessType: shop.business_type,
    serials: serials.data ?? [],
    manualEntries: manualEntries.data ?? [],
    expenses: expenses.data ?? [],
    reviews: reviews.data ?? [],
    chairs: chairs.data ?? [],
    services: services.data ?? [],
  });
}
