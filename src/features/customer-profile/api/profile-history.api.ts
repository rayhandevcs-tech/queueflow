import { getBrowserClient } from "@/lib/supabase/client";
import type { Serial, Shop } from "@/types";

/** Every serial the signed-in customer has ever booked, any status, newest first. */
export async function getMyAllSerials(): Promise<Serial[]> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("serials")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/** Batch shop lookup for history rows — avoids one query per row. */
export async function getShopsByIds(shopIds: string[]): Promise<Record<string, Shop>> {
  if (shopIds.length === 0) return {};
  const supabase = getBrowserClient();
  const { data, error } = await supabase.from("shops").select("*").in("id", shopIds);
  if (error) throw error;

  const byId: Record<string, Shop> = {};
  for (const shop of data) byId[shop.id] = shop;
  return byId;
}

/**
 * Best-effort: serial_id → star rating for the customer's own reviews.
 * Swallows errors so the profile page still renders if the `reviews` table
 * migration hasn't been applied yet — see supabase/migrations/.
 */
export async function getMyRatingsBySerial(): Promise<Record<string, number>> {
  try {
    const supabase = getBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from("reviews")
      .select("serial_id, rating")
      .eq("customer_id", user.id);

    if (error) throw error;
    const byId: Record<string, number> = {};
    for (const row of data) byId[row.serial_id] = row.rating;
    return byId;
  } catch {
    return {};
  }
}
