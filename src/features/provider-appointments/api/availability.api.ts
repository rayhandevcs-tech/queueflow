import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import { ymd } from "@/lib/day-key";
import type { StaffTimeOff, StaffWorkingHours } from "@/types";

/**
 * A beautician's own schedule and leave.
 *
 * Every read and write here is scoped by RLS through `is_chair_owner()` — a
 * shop cannot see, let alone edit, another shop's staff. There is no shop_id
 * to filter on and none is needed: the chair is the scope.
 */

export async function getStaffHours(chairIds: string[]): Promise<StaffWorkingHours[]> {
  if (chairIds.length === 0) return [];
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("staff_working_hours")
    .select("*")
    .in("chair_id", chairIds)
    .order("weekday");

  if (error) throw error;
  return data ?? [];
}

/**
 * Replace one weekday for one beautician.
 *
 * `null` means "does not work that day" and deletes the row, because a
 * missing row *is* the representation of a day off (decision 46). Keeping a
 * row with an `is_working = false` flag would give the same fact two
 * spellings, and they would eventually disagree.
 */
export async function setStaffDay(
  chairId: string,
  weekday: number,
  hours: { start: string; end: string } | null,
): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    if (!hours) {
      const { error } = await supabase
        .from("staff_working_hours")
        .delete()
        .eq("chair_id", chairId)
        .eq("weekday", weekday);
      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from("staff_working_hours")
      .upsert(
        { chair_id: chairId, weekday, start_time: hours.start, end_time: hours.end },
        { onConflict: "chair_id,weekday" },
      );
    if (error) throw error;
  });
}

export async function getTimeOff(chairIds: string[]): Promise<StaffTimeOff[]> {
  if (chairIds.length === 0) return [];
  const supabase = getBrowserClient();
  // Past leave is history nobody acts on; the list is about what is coming.
  const { data, error } = await supabase
    .from("staff_time_off")
    .select("*")
    .in("chair_id", chairIds)
    .gte("ends_at", new Date().toISOString())
    .order("starts_at");

  if (error) throw error;
  return data ?? [];
}

export async function addTimeOff(input: {
  chairId: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase.from("staff_time_off").insert({
      chair_id: input.chairId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      reason: input.reason ?? null,
    });
    if (error) throw error;
  });
}

export async function removeTimeOff(id: string): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase.from("staff_time_off").delete().eq("id", id);
    if (error) throw error;
  });
}

/**
 * Move an appointment.
 *
 * The RPC re-validates everything — staff, hours, leave, the past — and the
 * exclusion constraint decides overlap, exactly as at booking time. Nothing
 * here pre-checks; a slot that looked free can still be refused.
 */
export async function rescheduleAppointment(input: {
  appointmentId: string;
  startsAt: string;
  staffId?: string | null;
  reason?: string | null;
}): Promise<string> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("reschedule_appointment", {
      p_appointment_id: input.appointmentId,
      p_starts_at: input.startsAt,
      p_staff_id: input.staffId ?? null,
      p_reason: input.reason ?? null,
    });
    if (error) throw error;
    return data;
  });
}

/**
 * Free slots, for the owner's reschedule picker.
 *
 * The same RPC the customer books through — deliberately, so an owner cannot
 * move someone into a time the booking path would have refused. Not shared
 * with `customer-booking`'s copy because features may not import each other;
 * the duplication is four lines and the boundary is worth more.
 */
export async function getSlotsForReschedule(
  shopId: string,
  day: Date,
  serviceIds: string[],
  staffId?: string | null,
): Promise<{ staffId: string; staffName: string; startsAt: string; endsAt: string }[]> {
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
