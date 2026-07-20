import { getBrowserClient } from "@/lib/supabase/client";
import type { Shop, TablesUpdate } from "@/types";
import type { ShopFormOutput } from "../schemas/shop.schema";

/** The provider's own shop (unique owner_id ⇒ 0 or 1 row). */
export async function getMyShop(): Promise<Shop | null> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createShop(values: ShopFormOutput): Promise<Shop> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data, error } = await supabase
    .from("shops")
    .insert({ owner_id: user.id, ...values })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateShop(
  shopId: string,
  patch: TablesUpdate<"shops">,
): Promise<Shop> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .update(patch)
    .eq("id", shopId)
    .select()
    .single();

  if (error) throw error;
  return data;
}