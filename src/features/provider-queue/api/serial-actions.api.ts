import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { Serial, SerialStatus } from "@/types";

/** Shared status writer — the DB transition trigger is the real validator. */
async function setStatus(
  serialId: string,
  status: SerialStatus,
): Promise<Serial> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("serials")
      .update({ status })
      .eq("id", serialId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

export const startSerial = (serialId: string) =>
  setStatus(serialId, "IN_PROGRESS");

export const completeSerial = (serialId: string) => setStatus(serialId, "DONE");

export const markNoShow = (serialId: string) => setStatus(serialId, "NO_SHOW");

export const cancelByOwner = (serialId: string) =>
  setStatus(serialId, "CANCELLED");

export interface WalkInPayload {
  shopId: string;
  customerName: string;
  customerPhone: string | null;
  serviceIds: string[];
  /** null → DB assign_best_chair picks the earliest-finish lane. */
  chairId: string | null;
}

/**
 * INSERT only what the client may send — chair/position/snapshot/amount
 * are computed by the BEFORE INSERT trigger (and absent from the Insert type).
 */
export async function addWalkIn(payload: WalkInPayload): Promise<Serial> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("serials")
      .insert({
        shop_id: payload.shopId,
        is_walk_in: true,
        customer_name: payload.customerName.trim(),
        customer_phone: payload.customerPhone,
        service_ids: payload.serviceIds,
        chair_id: payload.chairId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/**
 * Lane transfer. The DB re-validates can_perform, locks the target lane,
 * re-positions, re-estimates duration, compacts the source lane, and
 * recalcs both — this call just states the intent.
 */
export async function moveSerial(
  serialId: string,
  targetChairId: string,
): Promise<Serial> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("serials")
      .update({ chair_id: targetChairId })
      .eq("id", serialId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}