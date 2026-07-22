import { getBrowserClient } from "@/lib/supabase/client";
import { ACTIVE_STATUSES } from "@/config/constants";
import type { Chair, Serial } from "@/types";

export interface TodaySummary {
  doneCount: number;
  income: number;
}

/**
 * The provider board's source of truth: every active serial of the shop,
 * full rows (owner RLS grants PII — name, phone, snapshot).
 * Ordering matches the DB's hot index (shop_id, status) + client sort key;
 * the client NEVER re-numbers `position`.
 */
export async function getShopQueue(shopId: string): Promise<Serial[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serials")
    .select("*")
    .eq("shop_id", shopId)
    .in("status", [...ACTIVE_STATUSES])
    .order("chair_id", { ascending: true })
    .order("position", { ascending: true });

  if (error) throw error;
  return data;
}

/** Sidebar badge — how many serials are currently waiting or in progress. */
export async function getLiveQueueCount(shopId: string): Promise<number> {
  const supabase = getBrowserClient();
  const { count, error } = await supabase
    .from("serials")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .in("status", [...ACTIVE_STATUSES]);

  if (error) throw error;
  return count ?? 0;
}

/** Sidebar's pinned "today's income" card — done jobs completed since local midnight. */
export async function getTodaySummary(shopId: string): Promise<TodaySummary> {
  const supabase = getBrowserClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("serials")
    .select("total_amount")
    .eq("shop_id", shopId)
    .eq("status", "DONE")
    .gte("completed_at", startOfDay.toISOString());

  if (error) throw error;
  return {
    doneCount: data.length,
    income: data.reduce((sum, row) => sum + row.total_amount, 0),
  };
}

/**
 * Lane definitions. ALL chairs (not just active): a chair deactivated
 * mid-shift may still hold live serials — lanes.ts decides visibility.
 * Deliberately local to this feature (no cross-feature import).
 */
export async function getAllChairs(shopId: string): Promise<Chair[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chairs")
    .select("*")
    .eq("shop_id", shopId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}