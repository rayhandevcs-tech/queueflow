import { getBrowserClient } from "@/lib/supabase/client";
import type { Favorite } from "@/types";

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

/** Full favourite rows — the profile list needs each one's alert threshold, not just its shop id. */
export async function getMyFavorites(): Promise<Favorite[]> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("favorites")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * "Tell me when this shop's wait drops below N." null turns it back into an
 * ordinary bookmark.
 */
export async function setFavoriteWaitAlert(
  favoriteId: string,
  waitAlertMin: number | null,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from("favorites")
    .update({ wait_alert_min: waitAlertMin })
    .eq("id", favoriteId);

  if (error) throw error;
}
