import { getBrowserClient } from "@/lib/supabase/client";
import type { Chair, ManualEntry, Service } from "@/types";
import type { DoneSerialRow, ManualEntryRow } from "../lib/compute-income";
import type { ManualEntryFormOutput } from "../schemas/manual-entry.schema";

function historySince(): string {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  return since.toISOString();
}

/**
 * Every DONE serial completed since the start of last year, PAID or DUE —
 * enough to derive today/month/year totals (cash vs due) and a trailing-
 * 12-month trend client-side without a dedicated DB aggregate. Fine at
 * small-shop volume. A DONE serial is always resolved to PAID or DUE by
 * completion time (see 20260806's migration comment) — ADVANCE never
 * survives to here, so it's excluded rather than treated as a third case.
 */
export async function getIncomeHistory(shopId: string): Promise<DoneSerialRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serials")
    .select("completed_at, total_amount, services_snapshot, payment_status, chair_id")
    .eq("shop_id", shopId)
    .eq("status", "DONE")
    .in("payment_status", ["PAID", "DUE"])
    .gte("completed_at", historySince());

  if (error) throw error;
  // The `.in()` filter above guarantees no ADVANCE row reaches here, but
  // supabase-js's typed client can't narrow payment_status from a runtime
  // filter — the full serials.payment_status enum stays in the inferred type.
  return data as DoneSerialRow[];
}

/** Raw manual-entry rows — same trailing-window as getIncomeHistory, used both for aggregation and the editable list. */
export async function getManualEntries(shopId: string): Promise<ManualEntry[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("manual_entries")
    .select("*")
    .eq("shop_id", shopId)
    .gte("created_at", historySince())
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Minimal service/chair lookups, kept local instead of importing
 * provider-catalog's — features may not depend on each other (see
 * eslint boundaries config). Fetches every service/chair (not just active
 * ones) so a manual entry referencing a since-deactivated service or
 * removed staff member still resolves to a name instead of going blank.
 */
export async function getShopServicesForEntries(shopId: string): Promise<Service[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getShopChairsForEntries(shopId: string): Promise<Chair[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chairs")
    .select("*")
    .eq("shop_id", shopId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

/** Joins raw manual_entries + a service-name lookup into the shape computeIncomeSummary expects. */
export function toManualEntryRows(
  entries: ManualEntry[],
  serviceNameById: Map<string, string>,
): ManualEntryRow[] {
  return entries.map((e) => ({
    created_at: e.created_at,
    amount: e.amount,
    chair_id: e.chair_id,
    payment_status: e.payment_status,
    service_name: serviceNameById.get(e.service_id) ?? "",
  }));
}

export async function createManualEntry(
  shopId: string,
  values: ManualEntryFormOutput,
): Promise<ManualEntry> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("manual_entries")
    .insert({ shop_id: shopId, ...values })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateManualEntry(
  entryId: string,
  values: ManualEntryFormOutput,
): Promise<ManualEntry> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("manual_entries")
    .update(values)
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteManualEntry(entryId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("manual_entries").delete().eq("id", entryId);
  if (error) throw error;
}
