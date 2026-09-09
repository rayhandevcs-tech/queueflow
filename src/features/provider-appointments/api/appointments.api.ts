import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { Appointment } from "@/types";
import { parseServicesSnapshot } from "@/types";
import type { AppointmentCard, AppointmentStatus } from "../lib/types";

/**
 * One day's appointments for a shop.
 *
 * The day is bounded in the browser's local zone — the same zone the board
 * draws in — so "today" means the same thing on both sides. RLS does the
 * shop scoping: this query would return nothing for a shop the signed-in
 * user does not own, with or without the `eq`.
 */
export async function getAppointmentsForDay(
  shopId: string,
  day: Date,
): Promise<AppointmentCard[]> {
  const supabase = getBrowserClient();
  const from = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("shop_id", shopId)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");

  if (error) throw error;
  return (data ?? []).map(toCard);
}

/** DB row → the view model the board has drawn since Sprint 2. */
export function toCard(row: Appointment): AppointmentCard {
  return {
    id: row.id,
    staffId: row.staff_id,
    customerName: row.customer_name || "",
    customerAvatarUrl: row.customer_avatar_url,
    // The snapshot, not a join on `services`: a service renamed or deleted
    // later must not rewrite what a past appointment was for.
    serviceNames: parseServicesSnapshot(row.services_snapshot).map((s) => s.name),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    totalAmount: row.total_amount,
    serviceIds: row.service_ids,
  };
}

/**
 * Move an appointment along its lifecycle.
 *
 * The status machine lives in `appointment_before_update()`; this sends the
 * target and lets the database refuse an illegal move. The UI only hides
 * buttons for moves it already knows are illegal — it never decides.
 */
export async function setAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
  reason?: string,
): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase
      .from("appointments")
      .update({ status, ...(reason ? { cancel_reason: reason } : {}) })
      .eq("id", appointmentId);

    if (error) throw error;
  });
}
