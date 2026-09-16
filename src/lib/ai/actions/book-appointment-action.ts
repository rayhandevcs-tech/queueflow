import "server-only";
import { translateDbError } from "@/lib/supabase/db-errors";
import type { ToolContext } from "../types";
import {
  AI_ACTION_BOOK_APPOINTMENT,
  ProposalError,
  type AppointmentDraft,
} from "../proposals";
import { buildAppointmentDraft } from "../tools/appointment-prepare";
import type { ActionExecutor, ActionOutcome, ConfirmedAction } from "./contract";

/**
 * BOOK_APPOINTMENT — revalidate, then call the app's own booking function.
 *
 * ---------------------------------------------------------------------------
 * There is no second booking engine, and there is no room for one
 * ---------------------------------------------------------------------------
 * The whole write is `supabase.rpc("book_appointment", …)`: the same function
 * the customer booking sheet calls, SECURITY INVOKER so RLS still applies,
 * inserting through `appointment_before_insert`, which computes `ends_at` from
 * `services.default_duration_min`, prices the row from `services.rate`,
 * snapshots the services, checks the staff member belongs to the shop and can
 * perform the work, and asks `staff_is_available()` about hours and time off.
 *
 * So nothing in this file decides whether a booking is allowed. It decides
 * whether to ASK, and it refuses early where a refusal is more useful than a
 * failure. If every check here were removed, the wrong booking would still be
 * refused — by the trigger, by RLS, and by `appointments_no_overlap`.
 *
 * ---------------------------------------------------------------------------
 * The race is the database's to win, and it does
 * ---------------------------------------------------------------------------
 * A slot shown as free is a snapshot, never a reservation. Between the
 * revalidation below and the insert, another customer can take that exact time.
 * `appointments_no_overlap` — an EXCLUDE constraint on
 * `(staff_id, tstzrange(starts_at, ends_at))` for active statuses — is what
 * decides, at insert time, with no window between a check and a write because
 * there is no check.
 *
 * `book_appointment()` already translates its `23P01` into `slot_taken`, which
 * `translateDbError` already turns into "somebody just took that time". So the
 * customer gets the same sentence the booking sheet gives them, and — the part
 * that matters — the assistant never says "booked successfully" for a booking
 * that did not happen: the success payload is built from a row that was read
 * back after the insert.
 */

/** Map `book_appointment`'s refusals onto this layer's vocabulary. */
function appointmentRefusal(error: unknown): ProposalError {
  const raw =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? error ?? "");
  const friendly = translateDbError(error);
  const detail = friendly.message || undefined;

  // `slot_taken` is the one that will actually happen in practice, and it is
  // the race — not a validation failure. Reported as SLOT_UNAVAILABLE so the
  // audit records "the time had gone" rather than a generic refusal.
  if (raw.includes("slot_taken") || raw.includes("appointments_no_overlap")) {
    return new ProposalError("SLOT_UNAVAILABLE", detail);
  }

  // A DEADLOCK is the same race wearing a different hat, and it took a real
  // parallel-client harness to find it — section J of
  // `run-sprint-ai4-checks.sh` hit it about one run in three.
  //
  // Two simultaneous inserts each hold their own row lock and then need a
  // ShareLock on the other's transaction to evaluate the GiST exclusion
  // constraint. Postgres detects the cycle and kills one of them with 40P01
  // instead of raising 23P01 — so `book_appointment()`'s exception handler,
  // which catches only `exclusion_violation`, does not translate it and the
  // caller sees "deadlock detected".
  //
  // The outcome is still correct: exactly one appointment exists, every time.
  // What was wrong was only the SENTENCE, and a customer told "deadlock
  // detected" has been given a database's internals instead of an answer. So
  // it is mapped here to the same thing it actually is.
  //
  // Mapped in this executor rather than by editing `book_appointment()`: that
  // function is shared with the customer booking sheet, and changing a core
  // RPC's exception handling is a wider change than this sprint should make
  // unasked. The consequence — that the booking SHEET still shows its generic
  // message for this rare case — is recorded as a known limitation rather
  // than quietly fixed here and left inconsistent there.
  if (raw.includes("deadlock detected") || raw.includes("40P01")) {
    return new ProposalError("SLOT_UNAVAILABLE");
  }
  if (raw.includes("appointment_in_past")) {
    return new ProposalError("SLOT_IN_PAST", detail);
  }
  // The staff member's own hours, their leave, or the shop's day off. All three
  // are `staff_is_available()`'s verdicts, and all three mean the same thing to
  // the customer: that time is not bookable with that person.
  if (
    raw.includes("outside_working_hours") ||
    raw.includes("staff_not_working_that_day") ||
    raw.includes("shop_closed_that_day") ||
    raw.includes("staff_on_leave")
  ) {
    return new ProposalError("SLOT_UNAVAILABLE", detail);
  }
  if (raw.includes("staff_inactive") || raw.includes("staff does not belong")) {
    return new ProposalError("STAFF_INACTIVE", detail);
  }
  if (raw.includes("cannot perform")) {
    return new ProposalError("STAFF_CANNOT_PERFORM", detail);
  }
  if (raw.includes("invalid service selection")) {
    return new ProposalError("SERVICE_WRONG_SHOP", detail);
  }
  if (raw.includes("shop is not active")) {
    return new ProposalError("SHOP_NOT_ACTIVE", detail);
  }
  return new ProposalError("APPOINTMENT_REFUSED", detail);
}

/**
 * Refuse a booking whose terms have moved since the customer was shown them.
 *
 * This is the rule from §11 of the sprint brief, and it is the only place in
 * this sprint where a refusal exists purely because agreeing to one number and
 * being charged another is wrong — the booking would otherwise succeed.
 *
 * Two comparisons, and both are strict:
 *
 *   · the TOTAL. `null` means "price not listed", which the card shows as such,
 *     so a service that has since been priced is a change too — strict
 *     equality over `number | null` catches both directions;
 *   · the DURATION. A card that said 5:00–6:00 describes a slot with a length.
 *     If the services now sum to 90 minutes, the thing on offer is a different
 *     slot, and that is what SLOT_UNAVAILABLE means.
 *
 * The alternative was re-pricing the card and asking again, which the brief
 * also permits. Refusing is simpler and fails in the safe direction: the
 * customer is told to ask again and sees a fresh card with the real figure,
 * rather than a card that silently changed while they were looking at it.
 *
 * Worth being explicit that JOIN_QUEUE does NOT have this check. Sprint 3
 * specified the opposite for the queue — the serial is priced by
 * `serial_before_insert` from the current rate and the card's figure is
 * documented as "what they were shown, never what they are charged" — so
 * adding it there would change Sprint 3's behaviour, which this sprint is not
 * supposed to do. It is an inconsistency, recorded as one in
 * docs/AI_ARCHITECTURE.md rather than dressed up as a principle.
 */
function assertTermsUnchanged(
  shown: AppointmentDraft | null,
  fresh: AppointmentDraft,
): void {
  if (!shown) return;
  if (shown.totalTaka !== fresh.totalTaka) {
    throw new ProposalError("PRICE_CHANGED");
  }
  if (shown.durationMin !== fresh.durationMin) {
    throw new ProposalError("SLOT_UNAVAILABLE");
  }
}

export const bookAppointmentExecutor: ActionExecutor = {
  actionType: AI_ACTION_BOOK_APPOINTMENT,

  async execute(ctx: ToolContext, action: ConfirmedAction): Promise<ActionOutcome> {
    // The slot parameters come off the stored row, never off the request. The
    // table's `ai_actions_slot_shape` constraint guarantees they travel as a
    // pair, so one being null means the row is not an appointment at all.
    if (!action.staffId || !action.startsAt) {
      throw new ProposalError("SLOT_NOT_OFFERED");
    }

    // The SAME rules `prepare_book_appointment` ran, from the same function.
    // This re-reads the shop, the services, the staff member and — through
    // `shop_available_slots()` — whether the slot is still free.
    const fresh = await buildAppointmentDraft(ctx, {
      shopId: action.shopId,
      serviceIds: action.serviceIds,
      staffId: action.staffId,
      startsAt: action.startsAt,
    });

    assertTermsUnchanged(
      action.display?.action === AI_ACTION_BOOK_APPOINTMENT ? action.display : null,
      fresh,
    );

    // The app's own booking function. `p_is_walk_in: false` so it stamps
    // `auth.uid()` as the customer itself — there is no parameter through which
    // a customer id could be supplied, and the
    // `appointments: customer insert` policy re-checks it anyway.
    //
    // `p_customer_name` and `p_customer_phone` are left null deliberately:
    // `appointment_before_insert` fills both from `profiles` for a non-walk-in,
    // so anything passed here would be discarded. Sending a value would imply
    // it mattered.
    const { data: appointmentId, error } = await ctx.supabase.rpc("book_appointment", {
      p_shop_id: action.shopId,
      p_staff_id: action.staffId,
      p_service_ids: action.serviceIds,
      p_starts_at: action.startsAt,
      p_is_walk_in: false,
      p_notes: null,
    });

    if (error || !appointmentId) throw appointmentRefusal(error);

    // Read the row back for the success card. Every figure the customer is
    // shown is therefore one the database wrote: `total_amount` and `ends_at`
    // were computed by the trigger, and the status is a column. Nothing is
    // carried over from the proposal and nothing is invented.
    return {
      resultId: appointmentId,
      payload: await readBooked(ctx, appointmentId, fresh),
    };
  },

  /**
   * An appointment is identified exactly, not approximately.
   *
   * `(customer_id, shop_id, staff_id, starts_at)` and an active status — and
   * `appointments_no_overlap` means at most one active appointment can exist
   * for that staff member at that instant. So a row found here IS the row this
   * proposal created; it cannot be a different booking that happens to look
   * similar.
   */
  async reconcile(ctx: ToolContext, action: ConfirmedAction) {
    if (!action.staffId || !action.startsAt) return null;

    const { data: rows } = await ctx.supabase
      .from("appointments")
      .select("id")
      .eq("customer_id", ctx.userId)
      .eq("shop_id", action.shopId)
      .eq("staff_id", action.staffId)
      .eq("starts_at", action.startsAt)
      .in("status", ["BOOKED", "CONFIRMED", "IN_PROGRESS"])
      .limit(1);

    const found = (rows ?? [])[0];
    if (!found) return null;

    return {
      resultId: found.id,
      alreadyExecuted: true,
      payload: await readBooked(ctx, found.id, null),
    };
  },
};

/**
 * The success payload, read from the appointment row.
 *
 * `fresh` supplies only the names — the shop's and the staff member's — which
 * are not columns on `appointments` and which a customer cannot reach by
 * joining under RLS. Every figure comes from the row. If the read fails the
 * payload carries the id alone rather than a plausible reconstruction: the
 * booking exists either way, and the customer's appointments screen is the
 * authority the card points them at.
 */
async function readBooked(
  ctx: ToolContext,
  appointmentId: string,
  fresh: AppointmentDraft | null,
): Promise<Record<string, unknown>> {
  const { data: row } = await ctx.supabase
    .from("appointments")
    .select("id, shop_id, staff_id, starts_at, ends_at, status, total_amount, service_ids")
    .eq("id", appointmentId)
    .maybeSingle();

  return {
    appointment: {
      id: appointmentId,
      startsAt: row?.starts_at ?? null,
      endsAt: row?.ends_at ?? null,
      status: row?.status ?? null,
      totalTaka: row?.total_amount ?? null,
    },
    ...(fresh
      ? {
          shop: { id: fresh.shopId, name: fresh.shopName },
          staff: { id: fresh.staffId, name: fresh.staffName },
          services: fresh.services.map((service) => ({
            name: service.name,
            priceTaka: service.priceTaka,
            durationMin: service.durationMin,
          })),
          durationMin: fresh.durationMin,
        }
      : {}),
  };
}
