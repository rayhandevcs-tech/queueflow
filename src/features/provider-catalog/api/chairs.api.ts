import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
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

/**
 * sort_order is read from the database, not counted in the client.
 *
 * It used to be `cachedChairs.length + 1`, which is only ever right while
 * nothing has been deleted. Remove the first of three chairs and the count
 * says 2 while a chair already sits at 3 — the insert then collides with it
 * and PostgREST returns 409, which is what "chair add doesn't work" looked
 * like. Asking for the current highest is correct however the list got there.
 */
export async function createChair(
  shopId: string,
  values: ChairFormOutput,
): Promise<Chair> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();

    const { data: last } = await supabase
      .from("chairs")
      .select("sort_order")
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("chairs")
      .insert({ shop_id: shopId, sort_order: (last?.sort_order ?? 0) + 1, ...values })
      .select()
      .single();

    if (error) throw error;
    return data; // DB trigger auto-seeds chair_service_stats for every service
  });
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
 * Chair removal, decided in the database.
 *
 * Doing it from the client meant two DELETEs against two tables with no
 * transaction around them, each meeting RLS and the protective triggers on its
 * own. The browser console showed exactly how that ends: the chairs DELETE
 * came back 409 (a foreign key still holds the row) and the deactivate
 * fallback came back 403 — so the owner could neither remove the chair nor
 * even pause it.
 *
 * delete_chair() checks ownership once, looks for serials itself, and either
 * removes the chair with its can-perform matrix or pauses it — in one
 * transaction, and returns which of the two happened rather than leaving the
 * client to infer it from an HTTP code.
 *
 * The rule is unchanged: a chair that has served anyone is paused, never
 * deleted. Its serials are the shop's income history.
 */
export async function deleteChair(chairId: string): Promise<{ deleted: boolean }> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("delete_chair", { p_chair_id: chairId });
    if (error) throw error;
    return { deleted: (data as { deleted?: boolean } | null)?.deleted ?? false };
  });
}

/**
 * Pause / resume a chair.
 *
 * Through the same RPC family as deletion, because the plain PATCH was coming
 * back 403 — the owner could not pause a chair any more than remove one, which
 * is why the delete fallback had nothing to fall back to.
 */
export async function setChairActive(chairId: string, isActive: boolean): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase.rpc("set_chair_active", {
      p_chair_id: chairId,
      p_active: isActive,
    });
    if (error) throw error;
  });
}
