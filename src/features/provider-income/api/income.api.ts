import { getBrowserClient } from "@/lib/supabase/client";
import type { DoneSerialRow } from "../lib/compute-income";

/**
 * Every DONE serial completed since the start of last year — enough to
 * derive today/month/year totals and a trailing-12-month trend client-side
 * without a dedicated DB aggregate. Fine at small-shop volume.
 */
export async function getIncomeHistory(shopId: string): Promise<DoneSerialRow[]> {
  const supabase = getBrowserClient();
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("serials")
    .select("completed_at, total_amount, services_snapshot")
    .eq("shop_id", shopId)
    .eq("status", "DONE")
    .gte("completed_at", since.toISOString());

  if (error) throw error;
  return data;
}
