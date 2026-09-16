import "server-only";
import type { ToolContext } from "../types";
import { ProposalError, type ProposalService } from "../proposals";

/**
 * The reads every prepare tool needs, in one place.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * A queue join and an appointment ask the same two questions of the services
 * they involve — do these belong to this shop, and are they switched on — and
 * take the same two facts away: the real price and the canonical duration. In
 * Sprint 3 that lived inside `join-queue-prepare.ts` because there was one
 * caller. Sprint 4 has three, and three copies of a rule is how one of them
 * ends up lenient.
 *
 * What is NOT here is anything action-specific. "Is this shop taking new
 * serials right now" and "is this shop ACTIVE so an appointment may be booked
 * into next week" are genuinely different questions with different answers, and
 * collapsing them into one `loadShop()` with a flag would have been the wrong
 * kind of sharing — see `loadJoinableShop` and `loadAppointmentShop`, which stay
 * apart on purpose.
 *
 * ---------------------------------------------------------------------------
 * None of these is the authority
 * ---------------------------------------------------------------------------
 * `serial_before_insert` and `appointment_before_insert` re-check every one of
 * these rules inside the write, from the same columns. What the checks here buy
 * is a confirmation card that is accurate when it is shown, and a refusal the
 * customer can act on ("that service was switched off") rather than a failure
 * after they have already agreed.
 */

/**
 * Read the services, and refuse any that is not this shop's and active.
 *
 * The prices come back with them, from `services.rate`, and the durations from
 * `services.default_duration_min`. There is no argument through which a caller
 * could supply either, and the figures actually recorded against the booking
 * are computed by the insert trigger from the same two columns — so the figure
 * on the card is the shop's, the figure in the ledger is the shop's, and
 * neither passed through the model.
 *
 * Every requested id must resolve. A missing one means the service was deleted,
 * or RLS will not show it — either way the booking the customer is being asked
 * to confirm is not the booking they would get, and quietly dropping it would
 * book something they did not ask for.
 */
export async function loadActiveServices(
  ctx: ToolContext,
  shopId: string,
  serviceIds: readonly string[],
): Promise<ProposalService[]> {
  const { data, error } = await ctx.supabase
    .from("services")
    .select("id, shop_id, name, rate, default_duration_min, is_active")
    .in("id", [...serviceIds]);

  if (error) throw new ProposalError("UNAVAILABLE");

  const rows = data ?? [];
  for (const id of serviceIds) {
    const row = rows.find((service) => service.id === id);
    if (!row) throw new ProposalError("SERVICE_NOT_FOUND");
    if (row.shop_id !== shopId) throw new ProposalError("SERVICE_WRONG_SHOP");
    if (!row.is_active) throw new ProposalError("SERVICE_INACTIVE");
  }

  // Ordered as the customer asked, not as Postgres returned them, so the card
  // lists them in the order the conversation established.
  return serviceIds.map((id) => {
    const row = rows.find((service) => service.id === id)!;
    return {
      serviceId: row.id,
      name: row.name,
      priceTaka: row.rate ?? null,
      durationMin: row.default_duration_min ?? null,
    };
  });
}
