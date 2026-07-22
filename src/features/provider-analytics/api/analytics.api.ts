import { getBrowserClient } from "@/lib/supabase/client";
import type { AnalyticsRow } from "../lib/compute-analytics";

/** DONE serials from the last 90 days — enough to see a real hourly/weekly pattern. */
export async function getAnalyticsHistory(shopId: string): Promise<AnalyticsRow[]> {
  const supabase = getBrowserClient();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data, error } = await supabase
    .from("serials")
    .select("completed_at, started_at")
    .eq("shop_id", shopId)
    .eq("status", "DONE")
    .gte("completed_at", since.toISOString());

  if (error) throw error;
  return data;
}
