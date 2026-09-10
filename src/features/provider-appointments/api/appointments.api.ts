import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { Appointment } from "@/types";
import { parseServicesSnapshot } from "@/types";
import type { ListQuery } from "../lib/list-query";
import type { AppointmentCard, AppointmentListRow, AppointmentStatus } from "../lib/types";

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

/**
 * How many rows the list will read at most.
 *
 * The list is a working record, not an archive: an owner scanning "everything"
 * wants the recent end of it, and a cap keeps one shop's growing history from
 * turning into an ever-slower page. A narrower scope or a date range is how
 * you reach further back.
 */
export const LIST_LIMIT = 300;

/**
 * The appointment list, filtered as `buildListQuery` decided.
 *
 * The `shop_id` filter is belt to RLS's braces — `appointments_owner_read`
 * already makes this query return nothing for a shop the caller does not own,
 * so the list cannot show another shop's bookings even if this line were
 * dropped. It stays because the index is on `(shop_id, starts_at)` and the
 * planner should use it.
 */
export async function getAppointmentList(
  shopId: string,
  query: ListQuery,
): Promise<AppointmentListRow[]> {
  const supabase = getBrowserClient();
  let q = supabase
    .from("appointments")
    .select("*")
    .eq("shop_id", shopId)
    .order("starts_at", { ascending: query.ascending })
    .limit(LIST_LIMIT);

  if (query.statuses) q = q.in("status", [...query.statuses]);
  if (query.startFrom) q = q.gte("starts_at", query.startFrom);
  if (query.startBefore) q = q.lt("starts_at", query.startBefore);
  if (query.staffId) q = q.eq("staff_id", query.staffId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toListRow);
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

/** The same card, plus what the list needs to say about the money. */
export function toListRow(row: Appointment): AppointmentListRow {
  return {
    ...toCard(row),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    dueAmount: row.due_amount,
    completedAt: row.completed_at,
    cancelReason: row.cancel_reason,
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

/**
 * Finish an appointment *and* record the money, in one update.
 *
 * The same two-way choice `completeSerial` records, against the same column
 * names — decision 29 mirrored serials' money columns onto `appointments` in
 * Sprint 4 precisely so completion, income and the due ledger would need no
 * second vocabulary:
 *
 * - `{ method }` → paid in full right now, `payment_status = 'PAID'`, counted
 *   toward income immediately.
 * - `{ due }`    → the owner let the balance stand ("বাকি"); it shows in the
 *   due ledger until marked collected there. No method is recorded, because
 *   nothing was actually collected.
 *
 * `total_amount` is deliberately *not* sent. `appointment_before_update()`
 * freezes it, so the appointment is closed at the price it was quoted — the
 * price snapshot is the price. The DONE transition itself is validated by that
 * same trigger, which also stamps `completed_at` (20260920); nothing here
 * decides whether the move is legal.
 */
export async function completeAppointment(
  appointmentId: string,
  payment: { method: string } | { due: number },
): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase
      .from("appointments")
      .update(
        "due" in payment
          ? {
              status: "DONE",
              payment_status: "DUE",
              due_amount: payment.due,
              due_collected_at: null,
              payment_method: null,
            }
          : {
              status: "DONE",
              payment_status: "PAID",
              due_amount: 0,
              due_collected_at: new Date().toISOString(),
              payment_method: payment.method,
            },
      )
      .eq("id", appointmentId);

    if (error) throw error;
  });
}

/**
 * The shop's accepted payment methods, for the completion sheet — a local
 * copy of `provider-queue`'s query rather than an import, because sibling
 * features may not import each other (the same duplication that sheet's own
 * comment explains). Falls back to `["cash"]` so the sheet is never empty.
 */
export async function getShopAcceptedPaymentMethods(shopId: string): Promise<string[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .select("accepted_payment_methods")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw error;
  return data?.accepted_payment_methods ?? ["cash"];
}
