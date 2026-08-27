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

/**
 * The shop's accepted payment methods, for the payment-confirmation sheet —
 * kept local instead of importing provider-catalog's shop hook (sibling-
 * feature import is forbidden). Falls back to `["cash"]` both when the row
 * predates the accepted_payment_methods migration (column absent) and while
 * loading, so the sheet never shows zero options.
 */
export async function getShopAcceptedPaymentMethods(shopId: string): Promise<string[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .select("accepted_payment_methods")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw error;
  return data?.accepted_payment_methods ?? ["cash"];
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
    .eq("payment_status", "PAID")
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
/**
 * Every serial in one party, for the payment sheet's "settle it all" option.
 *
 * Has to be its own fetch rather than a filter over the board: a member who
 * has already been served has left the board, and those are precisely the rows
 * that can still be carrying a balance.
 */
export async function getPartyDues(groupId: string): Promise<Serial[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serials")
    .select("*")
    .eq("group_id", groupId)
    .order("party_seq", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * The style each waiting customer asked for, keyed by serial id.
 *
 * A separate query rather than a join on getShopQueue: the board refetches on
 * every realtime tick, and the choices change perhaps once per booking. Keeping
 * them apart lets each cache on its own schedule and leaves the hot path alone.
 *
 * RLS on serial_style_preferences already limits this to the caller's own shop,
 * so the serial-id filter is about size, not access.
 */
export interface QueueStylePick {
  serialId: string;
  nameBn: string;
  nameEn: string;
  note: string | null;
  referenceImageUrl: string | null;
}

export async function getQueueStylePicks(
  serialIds: readonly string[],
): Promise<Map<string, QueueStylePick>> {
  if (serialIds.length === 0) return new Map();

  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serial_style_preferences")
    .select("serial_id, note, hairstyles(name_bn, name_en, reference_image_url)")
    .in("serial_id", [...serialIds]);

  if (error) throw error;

  const out = new Map<string, QueueStylePick>();
  for (const row of data ?? []) {
    // The embed is typed as an array by supabase-js even for a to-one FK.
    const style = Array.isArray(row.hairstyles) ? row.hairstyles[0] : row.hairstyles;
    if (!style) continue;
    out.set(row.serial_id, {
      serialId: row.serial_id,
      nameBn: style.name_bn,
      nameEn: style.name_en,
      note: row.note,
      referenceImageUrl: style.reference_image_url,
    });
  }
  return out;
}
