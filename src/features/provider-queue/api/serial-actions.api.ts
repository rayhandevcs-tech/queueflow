import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { Serial, TablesUpdate } from "@/types";

/** Shared row patcher — the DB transition trigger is the real validator. */
async function patchSerial(
  serialId: string,
  patch: TablesUpdate<"serials">,
): Promise<Serial> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("serials")
      .update(patch)
      .eq("id", serialId)
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

export const startSerial = (serialId: string) =>
  patchSerial(serialId, { status: "IN_PROGRESS" });

/**
 * `{ method }` → paid in full right now via that method, marked PAID and
 * counted toward income immediately.
 * `{ due: amount }` → provider left the balance outstanding ("বাকি"); it
 * shows up in the due ledger until marked collected there. No method is
 * recorded yet since nothing was actually collected.
 *
 * `finalAmount` is what was actually charged, which need not equal the sum of
 * the service rates — a bit of extra work, or a discount for a regular. The DB
 * accepts total_amount only on this one transition (see 20260912); every other
 * update still treats it as immutable. services_snapshot keeps the quoted
 * rates, so what was said and what was charged both survive.
 */
export const completeSerial = (
  serialId: string,
  payment: { method: string } | { due: number },
  finalAmount?: number,
) =>
  patchSerial(
    serialId,
    "due" in payment
      ? {
          status: "DONE",
          payment_status: "DUE",
          due_amount: payment.due,
          due_collected_at: null,
          payment_method: null,
          ...(finalAmount !== undefined && { total_amount: finalAmount }),
        }
      : {
          status: "DONE",
          payment_status: "PAID",
          due_amount: 0,
          due_collected_at: new Date().toISOString(),
          payment_method: payment.method,
          ...(finalAmount !== undefined && { total_amount: finalAmount }),
        },
  );

/** Manual time-extension on a running job — the DB trigger recalculates every ETA behind it. */
export const extendSerialTime = (serialId: string, newDuration: number, newExtended: number) =>
  patchSerial(serialId, {
    estimated_duration_min: newDuration,
    extended_min: newExtended,
  });

/**
 * Only reachable once the customer has been called and the grace window has
 * expired — serial_before_update rejects it otherwise (no_show_requires_call /
 * no_show_grace_period). "I know they aren't coming" is a cancel, not a no-show.
 */
export const markNoShow = (serialId: string) =>
  patchSerial(serialId, { status: "NO_SHOW" });

/** Starts the grace window and pushes a "you've been called" notification. */
export async function callSerial(serialId: string): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase.rpc("mark_serial_called", { p_serial_id: serialId });
    if (error) throw error;
  });
}

/**
 * Clears whatever the rest of a party still owes, in one payment. Returns how
 * many serials were settled.
 */
export async function settlePartyDues(groupId: string, method: string): Promise<number> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("settle_group_dues", {
      p_group_id: groupId,
      p_method: method,
    });
    if (error) throw error;
    return data ?? 0;
  });
}

/**
 * "He's on his way — you go first." Swaps with the next waiting serial on the
 * same chair and re-runs the ETA formula for both, server-side.
 */
export async function bumpSerialBack(serialId: string): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase.rpc("bump_serial_back", { p_serial_id: serialId });
    if (error) throw error;
  });
}

export const cancelByOwner = (serialId: string) =>
  patchSerial(serialId, { status: "CANCELLED" });

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