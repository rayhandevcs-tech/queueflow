import "server-only";
import { z } from "zod";
import { isAppointmentModel } from "@/lib/business-model";
import { dhakaDayKey } from "@/lib/day-key";
import type { BusinessType } from "@/types";
import type { DiscoveryLedgerLike, ToolContext, ToolDefinition } from "../types";
import {
  AI_ACTION_BOOK_APPOINTMENT,
  draftDuration,
  draftTotal,
  ProposalError,
  slotKey,
  type AppointmentDraft,
  type ProposalService,
} from "../proposals";
import { loadActiveServices } from "./shop-reads";

/**
 * `prepare_book_appointment` — the assistant asking, never acting.
 *
 * ---------------------------------------------------------------------------
 * What it does, and why that is still read-only
 * ---------------------------------------------------------------------------
 * It writes nothing. It checks the ids and the SLOT the model named against
 * what this request's discovery tools actually returned, re-reads the shop, the
 * services and the staff member, asks the availability engine whether the slot
 * is still free, and returns a description.
 *
 * The PROPOSED row is written afterwards by the route, from the draft this tool
 * leaves on the ledger. So `readOnly: true` is a statement of fact, and the
 * generic loop's refusal of non-read-only tools is untouched — nothing about
 * this sprint required weakening it, which was the point of putting the
 * mutation outside the loop in Sprint 3.
 *
 * ---------------------------------------------------------------------------
 * The model cannot invent a time. This is the mechanism.
 * ---------------------------------------------------------------------------
 * `shop_available_slots()` returns `(staff_id, staff_name, slot_start,
 * slot_end)` and no slot id — a slot is not a row, it is a gap computed from a
 * 15-minute grid minus what is already booked. So the whitelist key is the
 * deterministic tuple from `slotKey()`: shop, staff and the instant as epoch
 * milliseconds.
 *
 * `get_available_slots` records every slot it RETURNS. This tool refuses a key
 * it does not recognise before it runs a single query. So if the engine offered
 * 17:00 and the model asks for 17:30, the answer is SLOT_NOT_OFFERED — not a
 * lookup, not a near miss, not a booking.
 *
 * Two things the key deliberately does NOT include, and the reason is the same
 * for both: the services and the duration. A slot offered for a 30-minute
 * service is not necessarily free for a 60-minute one, and a key that pinned
 * the service set would have turned that into "you never saw this slot" when
 * the truthful answer is "that time cannot fit this work". So the ledger
 * answers "did you invent this?" and the re-query answers "is it bookable?" —
 * two questions, two mechanisms, and neither pretending to be the other.
 *
 * ---------------------------------------------------------------------------
 * Nothing here is the authority
 * ---------------------------------------------------------------------------
 * Every check is repeated at confirmation time from these same functions, and
 * then repeated AGAIN inside the write: `appointment_before_insert` re-checks
 * the shop, the services, the staff, the staff's working hours and time off,
 * and computes `ends_at` from `services.default_duration_min` itself — and the
 * `appointments_no_overlap` EXCLUDE constraint decides the race no amount of
 * checking can win. If this whole file were wrong, the booking would still be
 * refused. That is the property worth having.
 */

/** At most five services in one booking, matching the booking sheet. */
const MAX_SERVICES = 5;

const ArgsSchema = z.object({
  shopId: z
    .string()
    .uuid()
    .describe(
      "The parlour's shop id, taken from a search_shops or search_services result in THIS conversation turn. An id you did not receive from a tool will be rejected.",
    ),
  serviceIds: z
    .array(z.string().uuid())
    .min(1)
    .max(MAX_SERVICES)
    .describe(
      "Service ids from a search_services result in THIS turn. They must all belong to the shop above, and their durations decide how long the appointment is.",
    ),
  staffId: z
    .string()
    .uuid()
    .describe(
      "The staff id from the get_available_slots result you are proposing. Copy it exactly; you cannot choose a staff member the slot did not name.",
    ),
  startsAt: z
    .string()
    .min(1)
    .describe(
      "The slot's starts_at, copied EXACTLY from a get_available_slots result in this turn. You cannot adjust it, round it or pick a time close to it — a time that was not returned will be rejected.",
    ),
});

/**
 * Read the shop, and refuse anything that is not a parlour taking bookings.
 *
 * Split out so the confirm endpoint runs the identical check rather than a
 * paraphrase of it — "revalidated at confirmation" only means something if the
 * second check is the first check.
 *
 * Deliberately NOT the same rule as `loadJoinableShop`. That one asks
 * `canBookNow()` — "is this shop taking a serial right now" — and for an
 * appointment that question is wrong in both directions. A parlour closed at
 * 11pm can still take tomorrow's 5pm booking, and `appointment_before_insert`
 * says so in its own comment: it checks `status = 'ACTIVE'` and deliberately
 * does not look at `is_open`. Being stricter than the write would refuse
 * bookings the shop's own page accepts.
 */
export async function loadAppointmentShop(ctx: ToolContext, shopId: string) {
  const { data: shop, error } = await ctx.supabase
    .from("shops")
    .select("id, name, business_type, status")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw new ProposalError("UNAVAILABLE");
  if (!shop) throw new ProposalError("SHOP_NOT_FOUND");

  // A salon or unisex shop runs a queue. Refusing with a REASON is what lets
  // the assistant say "that one takes walk-ins — shall I put you in the line?"
  // instead of apologising, which is the whole argument for a code vocabulary.
  if (!isAppointmentModel(shop.business_type as BusinessType)) {
    throw new ProposalError("NOT_AN_APPOINTMENT_SHOP");
  }

  // The exact condition `appointment_before_insert` raises `shop is not active`
  // for. Checking it here converts a failure after the customer agreed into a
  // refusal before they were asked.
  if (shop.status !== "ACTIVE") throw new ProposalError("SHOP_NOT_ACTIVE");

  return shop;
}

/**
 * Read the staff member, and refuse anyone who cannot do this work.
 *
 * A `chairs` row is a seat in a salon and a beautician in a parlour — one
 * table, decided in Sprint 1. So "staff" here is `chairs.id`, which is also
 * what `shop_available_slots()` returns and what `book_appointment()` takes.
 *
 * The model never chooses a staff member independently: a slot carries its
 * staff, so choosing the slot is choosing the staff. This function exists to
 * catch the case where the row has changed since the slot was offered — the
 * shop switched the chair off, or renamed it — and to name the reason.
 *
 * `chair_service_stats` with no row means "can perform", which is what
 * `appointment_before_insert` and `CanPerformMatrix` both already assume. Two
 * different defaults would put the UI and the database in disagreement about
 * who does what.
 */
export async function loadAppointmentStaff(
  ctx: ToolContext,
  shopId: string,
  staffId: string,
  serviceIds: readonly string[],
) {
  const { data: staff, error } = await ctx.supabase
    .from("chairs")
    .select("id, shop_id, label, staff_name, is_active")
    .eq("id", staffId)
    .maybeSingle();

  if (error) throw new ProposalError("UNAVAILABLE");
  if (!staff) throw new ProposalError("STAFF_NOT_FOUND");
  // This is where a staff id borrowed from another shop stops. The database
  // refuses it too — `staff does not belong to this shop or is inactive` —
  // but a named refusal is more use to the model than a failed write.
  if (staff.shop_id !== shopId) throw new ProposalError("STAFF_WRONG_SHOP");
  if (!staff.is_active) throw new ProposalError("STAFF_INACTIVE");

  const { data: stats, error: statsError } = await ctx.supabase
    .from("chair_service_stats")
    .select("chair_id, service_id, can_perform")
    .eq("chair_id", staffId)
    .in("service_id", [...serviceIds]);

  if (statsError) throw new ProposalError("UNAVAILABLE");
  if ((stats ?? []).some((row) => row.can_perform === false)) {
    throw new ProposalError("STAFF_CANNOT_PERFORM");
  }

  // `staff_name` is what a customer would recognise; `label` ("Chair 2") is the
  // fallback the availability RPC itself uses, so the card and the slot list
  // name the same person the same way.
  return {
    id: staff.id,
    name: staff.staff_name?.trim() || staff.label,
  };
}

/**
 * Is this exact slot still free, according to the availability engine?
 *
 * `shop_available_slots()` and nothing else. It already accounts for the shop's
 * hours, the staff member's own hours, their time off, every existing
 * appointment and the canonical service durations — and it is SECURITY DEFINER
 * precisely so it can see other customers' bookings in order to exclude them,
 * which a customer's own RLS could never do.
 *
 * So there is no second availability calculation here, and there must never be.
 * What this function adds is one narrow thing: matching the engine's answer
 * against the specific instant being proposed, by epoch milliseconds rather
 * than by string, because Postgres and the JS client render the same moment
 * differently and a text comparison would refuse a legitimate slot.
 *
 * A snapshot, not a reservation. `appointments_no_overlap` is what actually
 * decides, at insert time — see the executor.
 */
export async function assertSlotAvailable(
  ctx: ToolContext,
  input: {
    shopId: string;
    serviceIds: readonly string[];
    staffId: string;
    startsAtMs: number;
  },
): Promise<void> {
  // The shop's calendar day, not the server's. A Node process runs in UTC, so
  // deriving this from `toISOString()` would look up a late-evening Dhaka slot
  // on the wrong date and report it as taken.
  const day = dhakaDayKey(input.startsAtMs);
  if (!day) throw new ProposalError("SLOT_NOT_OFFERED");

  const { data, error } = await ctx.supabase.rpc("shop_available_slots", {
    p_shop_id: input.shopId,
    p_date: day,
    p_service_ids: [...input.serviceIds],
    // Narrowed to the one staff member, so the grid returned is small and the
    // match below cannot accidentally succeed against somebody else's slot.
    p_staff_id: input.staffId,
  });

  if (error) throw new ProposalError("UNAVAILABLE");

  const free = (data ?? []).some(
    (slot) =>
      slot.staff_id === input.staffId &&
      Date.parse(slot.slot_start) === input.startsAtMs,
  );
  if (!free) throw new ProposalError("SLOT_UNAVAILABLE");
}

/**
 * Do they already hold this exact appointment?
 *
 * Narrow on purpose: the same shop, the same staff member, the same start, and
 * still active. That is the double-tap and the replay case, and catching it
 * turns "someone just took that time" into "you already have this booking",
 * which is true and actionable.
 *
 * What it deliberately does NOT do is refuse an appointment that overlaps one
 * at a DIFFERENT shop. The booking sheet allows that and the database has no
 * constraint against it, so refusing here would make the assistant stricter
 * than the button beside it — the same mistake Sprint 3 made once with shops on
 * a break, and it is its own kind of wrong answer.
 */
export async function assertNotAlreadyBooked(
  ctx: ToolContext,
  input: { shopId: string; staffId: string; startsAtIso: string },
): Promise<void> {
  const { data, error } = await ctx.supabase
    .from("appointments")
    .select("id")
    .eq("customer_id", ctx.userId)
    .eq("shop_id", input.shopId)
    .eq("staff_id", input.staffId)
    .eq("starts_at", input.startsAtIso)
    .in("status", ["BOOKED", "CONFIRMED", "IN_PROGRESS"])
    .limit(1);

  if (error) throw new ProposalError("UNAVAILABLE");
  if ((data ?? []).length > 0) throw new ProposalError("ALREADY_BOOKED");
}

/** Build the whole draft. Shared with the confirm endpoint's revalidation. */
export async function buildAppointmentDraft(
  ctx: ToolContext,
  input: {
    shopId: string;
    serviceIds: readonly string[];
    staffId: string;
    startsAt: string;
  },
): Promise<AppointmentDraft> {
  const startsAtMs = Date.parse(input.startsAt);
  if (!Number.isFinite(startsAtMs)) throw new ProposalError("SLOT_NOT_OFFERED");
  // The server's clock. `appointment_before_insert` raises
  // `appointment_in_past` for the same condition, and `shop_available_slots`
  // filters `slot_from > now()` besides — this is the one that produces a
  // sentence the customer can act on.
  if (startsAtMs <= ctx.now.getTime()) throw new ProposalError("SLOT_IN_PAST");

  const shop = await loadAppointmentShop(ctx, input.shopId);
  const services: ProposalService[] = await loadActiveServices(
    ctx,
    input.shopId,
    input.serviceIds,
  );

  // The canonical duration, and the ONLY source of it:
  // `services.default_duration_min`, summed. Never a rolling queue average and
  // never `chair_service_stats.rolling_avg_duration_min` — those describe how
  // long a job took in a live queue, and sizing an appointment from one would
  // put this tool at odds with the availability engine, which reads this
  // column. A missing duration is refused rather than guessed: an appointment
  // with an unknown length has no end, so it cannot be checked against anyone's
  // working hours.
  const durationMin = draftDuration(services);
  if (durationMin === null) throw new ProposalError("DURATION_UNAVAILABLE");

  const staff = await loadAppointmentStaff(
    ctx,
    input.shopId,
    input.staffId,
    input.serviceIds,
  );

  // Order matters: the duplicate check first, so a double-tap is told it
  // already has the booking rather than being told the slot has gone — which
  // is what the availability query below would say, since an appointment the
  // customer already holds removes the slot from the grid.
  const startsAtIso = new Date(startsAtMs).toISOString();
  await assertNotAlreadyBooked(ctx, {
    shopId: input.shopId,
    staffId: staff.id,
    startsAtIso,
  });

  await assertSlotAvailable(ctx, {
    shopId: input.shopId,
    serviceIds: input.serviceIds,
    staffId: staff.id,
    startsAtMs,
  });

  return {
    action: AI_ACTION_BOOK_APPOINTMENT,
    shopId: shop.id,
    shopName: shop.name,
    businessType: shop.business_type,
    services,
    totalTaka: draftTotal(services),
    durationMin,
    staffId: staff.id,
    staffName: staff.name,
    startsAt: startsAtIso,
    // The same arithmetic `appointment_before_insert` uses, shown so the card
    // can say "5:00–6:00". The row's real `ends_at` is computed by the trigger
    // from the trigger's own duration sum, not from this.
    endsAt: new Date(startsAtMs + durationMin * 60_000).toISOString(),
    slotKey: slotKey(shop.id, staff.id, startsAtMs),
  };
}

const prepareBookAppointment: ToolDefinition<typeof ArgsSchema> = {
  name: "prepare_book_appointment",
  description:
    "Prepare a parlour appointment for the customer to confirm. This does NOT book anything — it checks the shop, services, staff member and slot are still valid, reads the real price and the canonical duration, and produces a confirmation card the customer must approve themselves. " +
    "Only for appointment-based shops (parlours); a salon or unisex shop runs a live queue, so use prepare_join_queue for those. " +
    "Call get_available_slots FIRST in this same turn and copy a slot's staff_id and starts_at exactly — a time you were not given will be rejected, and you must never adjust or round one. " +
    "After calling this, tell the customer what is on the card and that they need to confirm it. Never say the appointment is booked.",
  readOnly: true,
  roles: ["customer"],
  schema: ArgsSchema,
  handler: async (args, ctx) => {
    const ledger = ctx.discovery as DiscoveryLedgerLike | undefined;
    // No ledger means no verified ids to check against, so nothing can be
    // proposed. This is the owner path, or a caller that forgot to build one —
    // either way refusing is the only safe answer.
    if (!ledger) throw new ProposalError("SHOP_NOT_OFFERED");

    // BEFORE any query: were these actually offered this request? A model that
    // invented a uuid or a time should not cause a database lookup at all —
    // refusing first means an invented id cannot even be used to ask whether
    // something exists.
    ledger.requireOffered("shop", [args.shopId]);
    ledger.requireOffered("service", args.serviceIds);
    ledger.requireOffered("slot", [
      slotKey(args.shopId, args.staffId, args.startsAt),
    ]);

    const draft = await buildAppointmentDraft(ctx, {
      shopId: args.shopId,
      serviceIds: args.serviceIds,
      staffId: args.staffId,
      startsAt: args.startsAt,
    });

    // Left for the route, which persists it once the loop has finished. The
    // model gets the fenced copy below for its wording; the row is written from
    // this object, so the two cannot disagree.
    ledger.draft = draft;

    return {
      prepared: true,
      shop: { id: draft.shopId, name: draft.shopName },
      staff: { name: draft.staffName },
      services: draft.services.map((service) => ({
        name: service.name,
        price_taka: service.priceTaka,
        duration_min: service.durationMin,
      })),
      total_taka: draft.totalTaka,
      duration_min: draft.durationMin,
      starts_at: draft.startsAt,
      ends_at: draft.endsAt,
      // Said in the payload, not only in the system prompt, so the model has it
      // as a fact from the tool rather than as a rule it might weigh against
      // the customer's insistence.
      note:
        "NOTHING HAS BEEN BOOKED and no time has been held. A confirmation card is now shown to the customer. " +
        "They must press confirm themselves. Tell them what it says and ask them to confirm — " +
        "do not say the appointment is booked, and do not give them a booking reference.",
    };
  },
};

export const APPOINTMENT_TOOLS: readonly ToolDefinition[] = [prepareBookAppointment];
