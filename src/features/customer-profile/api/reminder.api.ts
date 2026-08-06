import { getBrowserClient } from "@/lib/supabase/client";
import type { CustomerReminder } from "@/types";

/** At most one standing reminder per customer (unique constraint on customer_id). */
export async function getMyReminder(): Promise<CustomerReminder | null> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("customer_reminders")
    .select("*")
    .eq("customer_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Today + N days, as the plain `YYYY-MM-DD` the column stores. */
function nextDate(intervalDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + intervalDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Set or replace the customer's own reminder.
 *
 * Upsert on customer_id rather than insert-or-update in the client: the unique
 * constraint is the source of truth for "one reminder per person", and racing
 * two tabs shouldn't produce an error the customer has to understand.
 */
export async function saveMyReminder(
  intervalDays: number,
  shopId: string | null,
): Promise<CustomerReminder> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data, error } = await supabase
    .from("customer_reminders")
    .upsert(
      {
        customer_id: user.id,
        interval_days: intervalDays,
        shop_id: shopId,
        next_at: nextDate(intervalDays),
        active: true,
      },
      { onConflict: "customer_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMyReminder(): Promise<void> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("customer_reminders")
    .delete()
    .eq("customer_id", user.id);

  if (error) throw error;
}
