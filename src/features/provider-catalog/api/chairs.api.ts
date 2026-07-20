import { getBrowserClient } from "@/lib/supabase/client";
import type { Chair } from "@/types";
import type { ChairFormOutput } from "../schemas/chair.schema";

export async function getChairs(shopId: string): Promise<Chair[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chairs")
    .select("*")
    .eq("shop_id", shopId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createChair(
  shopId: string,
  values: ChairFormOutput,
  sortOrder: number,
): Promise<Chair> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chairs")
    .insert({ shop_id: shopId, sort_order: sortOrder, ...values })
    .select()
    .single();

  if (error) throw error;
  return data; // DB trigger auto-seeds chair_service_stats for every service
}

export async function updateChair(
  chairId: string,
  patch: Partial<ChairFormOutput> & {
    is_active?: boolean;
    staff_avatar_url?: string | null;
  },
): Promise<Chair> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chairs")
    .update(patch)
    .eq("id", chairId)
    .select()
    .single();

  if (error) throw error;
  return data;
}