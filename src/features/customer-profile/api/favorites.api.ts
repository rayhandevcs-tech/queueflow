import { getBrowserClient } from "@/lib/supabase/client";

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
