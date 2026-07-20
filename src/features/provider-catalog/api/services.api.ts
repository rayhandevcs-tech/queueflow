import { getBrowserClient } from "@/lib/supabase/client";
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