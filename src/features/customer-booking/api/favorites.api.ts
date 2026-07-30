import { getBrowserClient } from "@/lib/supabase/client";
import { translate } from "@/lib/i18n";
import { customerBookingDict } from "../lib/i18n";

export async function getMyFavoriteShopIds(): Promise<Set<string>> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("favorites")
    .select("shop_id")
    .eq("customer_id", user.id);

  if (error) throw error;
  return new Set(data.map((row) => row.shop_id));
}

export async function addFavorite(shopId: string): Promise<void> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(translate(customerBookingDict, "notLoggedIn"));

  const { error } = await supabase
    .from("favorites")
    .insert({ customer_id: user.id, shop_id: shopId });
  if (error) throw error;
}

export async function removeFavorite(shopId: string): Promise<void> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(translate(customerBookingDict, "notLoggedIn"));

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("customer_id", user.id)
    .eq("shop_id", shopId);
  if (error) throw error;
}
