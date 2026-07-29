import { getBrowserClient } from "@/lib/supabase/client";
import type { ShopRatingSummary } from "@/types";

export async function getAllShopRatings(): Promise<ShopRatingSummary[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.from("shop_rating_summary").select("*");

  if (error) throw error;
  return data;
}
