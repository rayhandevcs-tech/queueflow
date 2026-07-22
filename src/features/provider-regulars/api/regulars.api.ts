import { getBrowserClient } from "@/lib/supabase/client";
import type { VisitRow } from "../lib/compute-regulars";

/** Every DONE serial ever completed at this shop — needed to spot repeat customers. */
export async function getShopVisitHistory(shopId: string): Promise<VisitRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serials")
    .select("customer_id, customer_name, customer_phone, completed_at, status")
    .eq("shop_id", shopId)
    .eq("status", "DONE");

  if (error) throw error;
  return data;
}

/**
 * Reminder keys already sent this month — best-effort, empty if the
 * `regular_reminders` migration hasn't been applied yet (see supabase/migrations/).
 */
export async function getRemindersSentThisMonth(shopId: string): Promise<Set<string>> {
  try {
    const supabase = getBrowserClient();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("regular_reminders")
      .select("customer_id, customer_phone")
      .eq("shop_id", shopId)
      .gte("sent_at", startOfMonth.toISOString());

    if (error) throw error;
    const keys = new Set<string>();
    for (const row of data) {
      keys.add(row.customer_id ? row.customer_id : `phone:${row.customer_phone}`);
    }
    return keys;
  } catch {
    return new Set();
  }
}

export async function sendReminder(payload: {
  shopId: string;
  customerId: string | null;
  customerPhone: string | null;
}): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("regular_reminders").insert({
    shop_id: payload.shopId,
    customer_id: payload.customerId,
    customer_phone: payload.customerPhone,
  });
  if (error) throw error;
}
