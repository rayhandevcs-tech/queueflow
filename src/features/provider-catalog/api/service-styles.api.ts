import { getBrowserClient } from "@/lib/supabase/client";
import type { Hairstyle } from "@/types";

/**
 * Which catalogue styles a shop offers for each of its services (20260929).
 *
 * The vocabulary is platform-owned: a shop chooses WHICH styles it does, not
 * what they are called. That is a decision from 20260914 and it is load-bearing
 * — the Style Studio matches a customer's photo against this catalogue and
 * reads each row's description to do it, so a shop-typed string would be a
 * style the rest of the product cannot reason about. See the head of 20260929.
 *
 * Isolation is the database's job, not this file's. `service_styles` has no
 * `shop_id`; its policies resolve the owner through the service, so naming
 * another shop's `service_id` here is refused rather than filtered.
 */

export interface ServiceStyleRow {
  service_id: string;
  hairstyle_id: string;
  sort_order: number;
}

/** The styles a shop has switched on, for every service it owns. */
export async function listServiceStyles(shopId: string): Promise<ServiceStyleRow[]> {
  const supabase = getBrowserClient();
  // Filtered through the shop's own services rather than by a `shop_id` column
  // the table deliberately does not have.
  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id")
    .eq("shop_id", shopId);

  if (servicesError) throw servicesError;
  const ids = (services ?? []).map((s) => s.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("service_styles")
    .select("service_id, hairstyle_id, sort_order")
    .in("service_id", ids)
    .order("sort_order");

  if (error) throw error;
  return data ?? [];
}

/** The catalogue to pick from. Inactive styles are hidden, as everywhere else. */
export async function listStyleCatalogue(): Promise<Hairstyle[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("hairstyles")
    .select("*")
    .eq("is_active", true)
    .order("kind")
    .order("sort_order");

  if (error) throw error;
  return data ?? [];
}

/**
 * Replace the set of styles offered for one service.
 *
 * Written as a diff rather than "delete everything, insert everything" for one
 * reason that matters: a style a shop is keeping should not momentarily stop
 * existing. A customer mid-booking reading the list between the delete and the
 * insert would see an empty picker, and the rows carry a `created_at` that is
 * worth keeping honest.
 *
 * `sort_order` is rewritten from the incoming array's order every time, which
 * is what makes reordering work without a separate call.
 */
export async function setServiceStyles(
  serviceId: string,
  hairstyleIds: string[],
): Promise<void> {
  const supabase = getBrowserClient();

  const { data: existingRows, error: readError } = await supabase
    .from("service_styles")
    .select("hairstyle_id")
    .eq("service_id", serviceId);

  if (readError) throw readError;

  const existing = new Set((existingRows ?? []).map((r) => r.hairstyle_id));
  const wanted = new Set(hairstyleIds);
  const removed = [...existing].filter((id) => !wanted.has(id));

  if (removed.length > 0) {
    const { error } = await supabase
      .from("service_styles")
      .delete()
      .eq("service_id", serviceId)
      .in("hairstyle_id", removed);
    if (error) throw error;
  }

  if (hairstyleIds.length > 0) {
    // Upsert so the order of a style that was already offered is corrected
    // rather than conflicting on the composite primary key.
    const { error } = await supabase.from("service_styles").upsert(
      hairstyleIds.map((hairstyle_id, index) => ({
        service_id: serviceId,
        hairstyle_id,
        sort_order: index,
      })),
      { onConflict: "service_id,hairstyle_id" },
    );
    if (error) throw error;
  }
}
