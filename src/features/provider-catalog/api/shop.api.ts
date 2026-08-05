import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
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

/**
 * Start (or, with 0 minutes, end) a shop-wide break.
 *
 * Not a plain `shops` update: the owner could write break_until himself, but
 * nothing would recompute the queue until the next serial event, so every
 * waiting customer would sit on an ETA that silently ignores the break. The
 * RPC sets the column and re-runs the ETA formula for every chair in the same
 * call. Returns the new break end, or null when the break was ended.
 */
export async function setShopBreak(
  shopId: string,
  minutes: number,
  reason?: string | null,
): Promise<string | null> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("set_shop_break", {
      p_shop_id: shopId,
      p_minutes: minutes,
      p_reason: reason ?? null,
    });
    if (error) throw error;
    return data;
  });
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