import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import { ymd } from "@/lib/day-key";
import type { Appointment } from "@/types";

export interface Slot {
  staffId: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Free slots at a shop on one day.
 *
 * Everything that decides availability — the shop's hours for that weekday,
 * the service's length, which staff can perform it, and what is already
 * booked — is computed by `shop_available_slots()` in Postgres. Doing any of
 * it here would mean the browser deciding what is free using data it is not
 * allowed to read: a customer cannot see other customers' appointments, and
 * should not be able to.
 */
export async function getAvailableSlots(
  shopId: string,
  day: Date,
  serviceIds: string[],
  staffId?: string | null,
): Promise<Slot[]> {
  if (serviceIds.length === 0) return [];
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_available_slots", {
    p_shop_id: shopId,
    p_date: ymd(day),
    p_service_ids: serviceIds,
    p_staff_id: staffId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    staffId: row.staff_id,
    staffName: row.staff_name,
    startsAt: row.slot_start,
    endsAt: row.slot_end,
  }));
}

/**
 * Take one appointment.
 *
 * A slot shown as free is a snapshot, never a reservation — between the read
 * and this call someone else may have taken it. The exclusion constraint is
 * what actually decides, and `book_appointment` turns its rejection into
 * `slot_taken`, which the UI translates into "someone just took that time".
 */
export async function bookAppointment(input: {
  shopId: string;
  staffId: string;
  serviceIds: string[];
  startsAt: string;
  notes?: string | null;
}): Promise<string> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("book_appointment", {
      p_shop_id: input.shopId,
      p_staff_id: input.staffId,
      p_service_ids: input.serviceIds,
      p_starts_at: input.startsAt,
      p_is_walk_in: false,
      p_notes: input.notes ?? null,
    });

    if (error) throw error;
    return data;
  });
}

/** An appointment with the shop's name, which the customer's list needs. */
export type MyAppointment = Appointment & { shops: { name: string } | null };

/**
 * The signed-in customer's own appointments.
 *
 * `customer_id = auth.uid()` is belt and braces — the SELECT policy already
 * limits this to their own rows and the shops they own.
 */
export async function getMyAppointments(): Promise<MyAppointment[]> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("appointments")
    .select("*, shops(name)")
    .eq("customer_id", user.id)
    .order("starts_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  // The embedded shop isn't described in the hand-written database types, so
  // the join's shape is asserted here rather than threaded through them.
  return (data ?? []) as unknown as MyAppointment[];
}

/**
 * Cancel one's own appointment.
 *
 * A plain update, exactly like `cancelMySerial`: the customer's UPDATE policy
 * only accepts a row that lands on CANCELLED, and the status machine in
 * `appointment_before_update` refuses anything else.
 */
export async function cancelMyAppointment(appointmentId: string): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase
      .from("appointments")
      .update({ status: "CANCELLED" })
      .eq("id", appointmentId);

    if (error) throw error;
  });
}
