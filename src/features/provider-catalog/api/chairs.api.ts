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

/**
 * Hard-deletes the chair when nothing references it; falls back to pausing it
 * when history is in the way.
 *
 * TWO REASONS THIS NEVER ACTUALLY DELETED ANYTHING
 *
 * 1. chair_service_stats holds one row per (chair, service) — the can-perform
 *    matrix. Every chair has them, always, from the moment it is created. They
 *    are configuration, not history, but the foreign key does not know that, so
 *    the delete was rejected 23503 every single time and quietly downgraded to
 *    "pause". The matrix is cleared first now; the chair's serials are history
 *    and are still allowed to block the delete.
 *
 * 2. A DELETE that matches no row is not an error in PostgREST. If RLS refuses
 *    it, you get `error === null` and zero rows — which the old code read as
 *    success, told the user the chair was gone, and then showed it again on the
 *    next refetch. Asking for the deleted rows back (`.select()`) is what makes
 *    the difference between "deleted" and "silently refused" visible.
 */
export async function deleteChair(chairId: string): Promise<{ deleted: boolean }> {
  const supabase = getBrowserClient();

  await supabase.from("chair_service_stats").delete().eq("chair_id", chairId);

  const { data, error } = await supabase
    .from("chairs")
    .delete()
    .eq("id", chairId)
    .select("id");

  if (error) {
    // Still referenced by serials — real history, worth keeping. Pause instead.
    if (error.code === "23503") {
      await updateChair(chairId, { is_active: false });
      return { deleted: false };
    }
    throw error;
  }

  if (data && data.length > 0) return { deleted: true };

  // No error, no row. Either it was already gone, or a policy refused it —
  // and those need different answers, so ask rather than guess.
  const { data: survivor } = await supabase
    .from("chairs")
    .select("id")
    .eq("id", chairId)
    .maybeSingle();

  if (!survivor) return { deleted: true };

  await updateChair(chairId, { is_active: false });
  return { deleted: false };
}