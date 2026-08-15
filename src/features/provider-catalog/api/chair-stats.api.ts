import { getBrowserClient } from "@/lib/supabase/client";
import type { ChairServiceStat } from "@/types";

/** All stats rows for a shop's chairs (auto-provisioned by DB triggers). */
export async function getChairStats(
  shopId: string,
): Promise<ChairServiceStat[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chair_service_stats")
    .select("*, chairs!inner(shop_id)")
    .eq("chairs.shop_id", shopId);

  if (error) throw error;
  // strip the join helper before returning
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it
  return data.map(({ chairs: _chairs, ...row }) => row as ChairServiceStat);
}

/**
 * Only can_perform is client-writable; learned columns are trigger-guarded.
 *
 * Upsert, not update. An UPDATE that matches no row is not an error — it just
 * changes nothing — so before the seeding triggers existed, toggling a cell for
 * a chair with no stats row appeared to work and silently did nothing. The
 * triggers mean the row is normally there; upserting means a missing one is
 * created rather than swallowing the owner's tap.
 */
export async function setCanPerform(
  chairId: string,
  serviceId: string,
  canPerform: boolean,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from("chair_service_stats")
    .upsert(
      { chair_id: chairId, service_id: serviceId, can_perform: canPerform },
      { onConflict: "chair_id,service_id" },
    );

  if (error) throw error;
}