import { getBrowserClient } from "@/lib/supabase/client";
import type { Shop } from "@/types";

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

/** How many people are currently waiting/being served, per shop — PII-free. */
export async function getActiveQueueCounts(): Promise<Record<string, number>> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.from("queue_public").select("shop_id");

  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.shop_id] = (counts[row.shop_id] ?? 0) + 1;
  }
  return counts;
}
