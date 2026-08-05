import { getBrowserClient } from "@/lib/supabase/client";
import { translateDbError, UiDbError, withDbErrors } from "@/lib/supabase/db-errors";
import type { DueSerialRow } from "../lib/compute-due-ledger";

export interface DueManualEntryRow {
  id: string;
  service_name: string;
  note: string | null;
  amount: number;
  created_at: string;
}

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

/**
 * DUE manual entries — a serial-less job (see provider-income) has no
 * customer to owe against, so each one shows up in বাকির খাতা on its own
 * instead of being grouped like customer serials are. Two queries instead
 * of an embedded services() select, matching provider-income's own
 * toManualEntryRows pattern — cross-feature imports aren't allowed (see
 * boundaries config), and manual_entries has no typed FK relationship to
 * services in database.types.ts for a select-string embed to rely on.
 */
export async function getDueManualEntries(shopId: string): Promise<DueManualEntryRow[]> {
  const supabase = getBrowserClient();
  const [entriesRes, servicesRes] = await Promise.all([
    supabase
      .from("manual_entries")
      .select("id, service_id, note, amount, created_at")
      .eq("shop_id", shopId)
      .eq("payment_status", "DUE")
      .order("created_at", { ascending: true }),
    supabase.from("services").select("id, name").eq("shop_id", shopId),
  ]);

  if (entriesRes.error) throw entriesRes.error;
  if (servicesRes.error) throw servicesRes.error;

  const nameById = new Map(servicesRes.data.map((s) => [s.id, s.name]));
  return entriesRes.data.map((row) => ({
    id: row.id,
    note: row.note,
    amount: row.amount,
    created_at: row.created_at,
    service_name: nameById.get(row.service_id) ?? "",
  }));
}

/** Sidebar badge — raw count of unsettled manual entries. */
export async function getDueManualEntryCount(shopId: string): Promise<number> {
  const supabase = getBrowserClient();
  const { count, error } = await supabase
    .from("manual_entries")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("payment_status", "DUE");

  if (error) throw error;
  return count ?? 0;
}

/** "আদায় হয়েছে" for a manual entry — settles it and counts it toward income's cash total. */
export async function markManualEntryCollected(entryIds: string[]): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase
      .from("manual_entries")
      .update({ payment_status: "PAID" })
      .in("id", entryIds);

    if (error) throw error;
  });
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
