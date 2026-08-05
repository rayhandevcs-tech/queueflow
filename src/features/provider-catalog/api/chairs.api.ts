import { getBrowserClient } from "@/lib/supabase/client";
import { ACTIVE_STATUSES } from "@/config/constants";
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

/** True if a currently-active (waiting/in-progress) serial references this chair. */
export async function isChairInActiveUse(shopId: string, chairId: string): Promise<boolean> {
  const supabase = getBrowserClient();
  const { count, error } = await supabase
    .from("serials")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .in("status", ACTIVE_STATUSES)
    .eq("chair_id", chairId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Hard-deletes the chair when nothing references it; falls back to pausing it if a foreign key blocks the delete. */
export async function deleteChair(chairId: string): Promise<{ deleted: boolean }> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("chairs").delete().eq("id", chairId);

  if (!error) return { deleted: true };
  if (error.code === "23503") {
    await updateChair(chairId, { is_active: false });
    return { deleted: false };
  }
  throw error;
}