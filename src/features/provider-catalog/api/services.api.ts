import { getBrowserClient } from "@/lib/supabase/client";
import { ACTIVE_STATUSES } from "@/config/constants";
import type { Service } from "@/types";
import type { ServiceFormOutput } from "../schemas/service.schema";

export async function getServices(shopId: string): Promise<Service[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createService(
  shopId: string,
  values: ServiceFormOutput,
): Promise<Service> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("services")
    .insert({ shop_id: shopId, ...values })
    .select()
    .single();

  if (error) throw error;
  return data; // DB trigger auto-seeds chair_service_stats for every chair
}

export async function updateService(
  serviceId: string,
  values: ServiceFormOutput,
): Promise<Service> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("services")
    .update(values)
    .eq("id", serviceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Deactivate, never delete — history snapshots + stats stay clean. */
export async function setServiceActive(
  serviceId: string,
  isActive: boolean,
): Promise<Service> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("services")
    .update({ is_active: isActive })
    .eq("id", serviceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** True if a currently-active (waiting/in-progress) serial references this service. */
export async function isServiceInActiveUse(
  shopId: string,
  serviceId: string,
): Promise<boolean> {
  const supabase = getBrowserClient();
  const { count, error } = await supabase
    .from("serials")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .in("status", ACTIVE_STATUSES)
    .contains("service_ids", [serviceId]);

  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Real delete, allowed by RLS for the shop owner. `chair_service_stats`'s FK
 * to `services` isn't captured in any tracked migration (that base table
 * predates this repo's migration history), so its ON DELETE behavior is
 * unknown — if Postgres rejects the delete with a foreign-key violation
 * (23503), fall back to deactivating so the action never dead-ends.
 */
export async function deleteService(serviceId: string): Promise<{ deleted: boolean }> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("services").delete().eq("id", serviceId);

  if (!error) return { deleted: true };
  if (error.code === "23503") {
    await setServiceActive(serviceId, false);
    return { deleted: false };
  }
  throw error;
}