import { getBrowserClient } from "@/lib/supabase/client";
import { translateDbError, UiDbError, withDbErrors } from "@/lib/supabase/db-errors";
import type { DueSerialRow } from "../lib/compute-due-ledger";

/** Every completed-but-unsettled serial at this shop — the raw rows behind "বাকির খাতা". */
export async function getDueSerials(shopId: string): Promise<DueSerialRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serials")
    .select(
      "id, customer_id, customer_name, customer_phone, customer_avatar_url, due_amount, completed_at, due_reminded_at",
    )
    .eq("shop_id", shopId)
    .eq("status", "DONE")
    .eq("payment_status", "DUE")
    .order("completed_at", { ascending: true });

  if (error) throw error;
  return data;
}

/** Sidebar badge — raw count of unsettled serials (not distinct customers). */
export async function getDueCount(shopId: string): Promise<number> {
  const supabase = getBrowserClient();
  const { count, error } = await supabase
    .from("serials")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "DONE")
    .eq("payment_status", "DUE");

  if (error) throw error;
  return count ?? 0;
}

/** "আদায় হয়েছে" — settles every due visit for one customer at once; each row now counts toward income. */
export async function markDueCollected(serialIds: string[]): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase
      .from("serials")
      .update({
        payment_status: "PAID",
        due_amount: 0,
        due_collected_at: new Date().toISOString(),
      })
      .in("id", serialIds);

    if (error) throw error;
  });
}

/**
 * One reminder notification per still-due serial (each carries its own
 * accurate amount). The DB rate-limits each serial to once/day — when a
 * customer has several due serials and only some are already rate-limited
 * today, this still sends the rest instead of aborting on the first hit.
 */
export async function sendDueReminders(serialIds: string[]): Promise<void> {
  const supabase = getBrowserClient();
  let lastRealError: unknown = null;

  for (const serialId of serialIds) {
    const { error } = await supabase.rpc("send_due_reminder", { p_serial_id: serialId });
    if (error && !translateDbError(error).silent) lastRealError = error;
  }

  if (lastRealError) throw new UiDbError(translateDbError(lastRealError));
}
