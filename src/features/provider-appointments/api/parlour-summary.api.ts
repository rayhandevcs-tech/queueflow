import { getBrowserClient } from "@/lib/supabase/client";
import type { Chair, Service } from "@/types";

/**
 * The two lists the parlour home counts.
 *
 * These deliberately mirror the queries the dashboard page already prefetches,
 * key for key and shape for shape, so the tiles read straight out of the
 * hydrated cache and cost nothing on first paint. Keeping them here rather
 * than importing provider-catalog's hooks is the boundary rule: features may
 * not import each other.
 */

export async function getChairsForSummary(shopId: string): Promise<Chair[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chairs")
    .select("*")
    .eq("shop_id", shopId)
    .order("sort_order");

  if (error) throw error;
  return data ?? [];
}

export async function getActiveServicesForSummary(shopId: string): Promise<Service[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("created_at");

  if (error) throw error;
  return data ?? [];
}
