import { getBrowserClient } from "@/lib/supabase/client";
import type { QueuePublicRow, Shop } from "@/types";

/** Publicly browsable shops — RLS only exposes rows where is_open = true. */
export async function getOpenShops(): Promise<Shop[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("is_open", true)
    .order("name");

  if (error) throw error;
  return data;
}

/**
 * Live queue rows across all shops, PII-free — powers both the "N waiting"
 * badge and the "~M min wait" estimate on the explore list/map.
 */
export async function getLiveQueue(): Promise<QueuePublicRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("queue_public")
    .select("shop_id, chair_id, position, status, is_walk_in, estimated_duration_min, estimated_start_at, updated_at, id");

  if (error) throw error;
  return data;
}
