import { getBrowserClient } from "@/lib/supabase/client";
import { catalogueOrFilter } from "@/lib/shop-catalogue";
import type { QueuePublicRow, Shop } from "@/types";

/**
 * Publicly browsable shops. RLS narrows this to `status = 'ACTIVE'`.
 *
 * **This used to be `.eq("is_open", true)`, and that hid parlours.** The open
 * switch is the queue's "taking walk-ins right now" flag; an appointment shop
 * is booked days ahead and the database already ignores the switch for it
 * (`appointment_before_insert` gates on `status`, not `is_open`, and says so
 * in a comment). So a parlour that had never touched the switch was bookable
 * from its own shop page and absent from the map that leads there.
 *
 * `catalogueOrFilter()` is the one place that rule is written — the AI's shop
 * search reads the same function, because an assistant denying a parlour
 * exists while the map draws its pin is worse than either answer alone.
 */
export async function getOpenShops(): Promise<Shop[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .or(catalogueOrFilter())
    .order("name");

  if (error) throw error;
  return data;
}

/**
 * Live queue rows across all shops, PII-free — powers both the "N waiting"
 * badge and the "~M min wait" estimate on the explore list/map.
 */
export async function getLiveQueue(): Promise<QueuePublicRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("queue_public")
    .select("shop_id, chair_id, position, status, is_walk_in, estimated_duration_min, estimated_start_at, updated_at, id");

  if (error) throw error;
  return data;
}
