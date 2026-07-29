import { getBrowserClient } from "@/lib/supabase/client";
import type { ReviewRow } from "@/lib/reviews";

export async function getShopReviews(shopId: string): Promise<ReviewRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, serial_id, rating, comment, images, chair_id, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/** Staff names for the "auto-tagged" line under each review — this feature can't
 * import provider-catalog's chairs hook (sibling-feature import is forbidden),
 * so it keeps its own tiny lookup. */
export async function getChairNames(shopId: string): Promise<Record<string, string>> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chairs")
    .select("id, staff_name, label")
    .eq("shop_id", shopId);

  if (error) throw error;
  const byId: Record<string, string> = {};
  for (const row of data) byId[row.id] = row.staff_name || row.label;
  return byId;
}

/** customer_name lives on `serials`, not `reviews` — batch lookup, one owner-scoped query. */
export async function getSerialCustomerNames(serialIds: string[]): Promise<Record<string, string>> {
  if (serialIds.length === 0) return {};
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serials")
    .select("id, customer_name")
    .in("id", serialIds);

  if (error) throw error;
  const byId: Record<string, string> = {};
  for (const row of data) byId[row.id] = row.customer_name;
  return byId;
}
