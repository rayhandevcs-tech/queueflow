import { getBrowserClient } from "@/lib/supabase/client";
import type { ExpenseTxRow, ManualTxRow, SerialTxRow } from "../lib/build-transactions";

/**
 * A rolling year, matching the income page's window. Small-shop volume, so the
 * merge and the day-grouping happen client-side rather than behind a view.
 */
function historySince(): string {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  since.setHours(0, 0, 0, 0);
  return since.toISOString();
}

/**
 * Completed serials, with the customer's booking-time name and photo.
 *
 * The photo comes from serials.customer_avatar_url, not from a join: RLS lets
 * a customer read only their own profiles row, so the snapshot taken at
 * booking is the only way the shop side can show a face.
 */
export async function getSerialTransactions(shopId: string): Promise<SerialTxRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serials")
    .select(
      "id, completed_at, total_amount, payment_status, payment_method, customer_name, customer_avatar_url, party_member_name, is_walk_in, services_snapshot",
    )
    .eq("shop_id", shopId)
    .eq("status", "DONE")
    .gte("completed_at", historySince())
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return data as SerialTxRow[];
}

export async function getManualTransactions(shopId: string): Promise<ManualTxRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("manual_entries")
    .select("id, amount, created_at, payment_status, payment_method, customer_name, note")
    .eq("shop_id", shopId)
    .gte("created_at", historySince())
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as ManualTxRow[];
}

export async function getExpenseTransactions(shopId: string): Promise<ExpenseTxRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shop_expenses")
    .select("id, amount, spent_on, category, note")
    .eq("shop_id", shopId)
    .gte("spent_on", historySince().slice(0, 10))
    .order("spent_on", { ascending: false });

  if (error) throw error;
  return data as ExpenseTxRow[];
}
