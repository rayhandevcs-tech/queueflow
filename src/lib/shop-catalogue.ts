import { BUSINESS_TYPES_BY_MODEL, isAppointmentModel } from "./business-model";
import { shopAvailability, type ShopAvailability } from "./shop-availability";
import type { BusinessType, Shop } from "@/types";

/**
 * Which shops belong in the customer catalogue, and what to say about them.
 *
 * ---------------------------------------------------------------------------
 * The bug this exists to fix
 * ---------------------------------------------------------------------------
 * The customer catalogue asked for `is_open = true` and nothing else, so a
 * parlour whose owner had not flipped the open switch appeared on no map, in
 * no list and in no rail. That is wrong, and it is wrong in a way that only
 * ever hit parlours, because the database had already decided the opposite:
 *
 *   `appointment_before_insert` (20260918) deliberately does NOT check
 *   `is_open`, and says why — "ওটা কিউয়ের 'এই মুহূর্তে খোলা' ফ্ল্যাগ। আগামীকালের
 *   অ্যাপয়েন্টমেন্ট রাত ১১টায় নেওয়া যাবে না — এমন নিয়ম অ্যাপয়েন্টমেন্ট ব্যবসায়
 *   অর্থহীন।" It gates on `status = 'ACTIVE'` instead.
 *
 *   `ShopDetailView` had already been fixed to match: `bookable = appointment
 *   ? shop.status === "ACTIVE" : canBookNow(shop)`.
 *
 * So the write path would happily take tomorrow's appointment and the shop
 * page would happily offer it — but the catalogue that gets you to that page
 * had hidden the shop. The rule was fixed in two places out of three.
 *
 * A salon is the opposite case and stays as it was: `serials_before_insert`
 * raises `shop is not open`, so a closed salon genuinely cannot take a serial
 * and listing it would send people to a door that is shut.
 *
 * ---------------------------------------------------------------------------
 * Why a module rather than a fix in one query
 * ---------------------------------------------------------------------------
 * Three separate readers filter this: the explore catalogue, and the AI
 * `find_shops` and `search_services` tools. They have to agree — an assistant
 * that says "no parlours near you" about a parlour the map is drawing is worse
 * than either behaviour on its own.
 */

/**
 * The `business_type` values that are bookable regardless of `is_open`.
 *
 * Derived from `BUSINESS_TYPES_BY_MODEL` rather than written as `["PARLOUR"]`,
 * because nothing outside `business-model.ts` is allowed an opinion about what
 * a business type means.
 */
export const ALWAYS_LISTED_BUSINESS_TYPES: readonly BusinessType[] =
  BUSINESS_TYPES_BY_MODEL.APPOINTMENT;

/**
 * The same rule as a PostgREST `or()` filter.
 *
 * `.or("is_open.eq.true,business_type.eq.PARLOUR")` — an appointment shop is
 * listed whatever its switch says, a queue shop only while it is open. RLS
 * still applies on top, and it is RLS that keeps a non-ACTIVE shop out
 * entirely ("shops: public read" in 20260824), so this does not need to
 * re-check `status`.
 */
export const catalogueOrFilter = (): string =>
  [
    "is_open.eq.true",
    ...ALWAYS_LISTED_BUSINESS_TYPES.map((type) => `business_type.eq.${type}`),
  ].join(",");

/**
 * Should this shop appear in the catalogue?
 *
 * The client-side twin of `catalogueOrFilter`, for filtering a list that is
 * already in hand. Both must agree; the test asserts they do.
 */
export function isListedInCatalogue(
  shop: Pick<Shop, "is_open"> & { business_type?: BusinessType | null },
): boolean {
  return isAppointmentModel(shop.business_type) || shop.is_open === true;
}

/**
 * What a catalogue card, pin or badge should say about a shop.
 *
 * `BY_APPOINTMENT` is the new answer, and it exists because the alternative
 * was a new lie: having stopped hiding a parlour with `is_open = false`, the
 * pin would have drawn it grey and the popup would have said "বন্ধ" about a
 * shop that will take a booking for tomorrow morning.
 *
 * For an appointment shop the open/closed switch is simply not the question —
 * which day and which slot is, and that is the booking sheet's answer, not a
 * badge's. So the badge stops pretending to know and says what the shop is.
 *
 * `shopAvailability()` is deliberately left alone: it is the QUEUE's rule
 * ("can somebody take a serial this second"), the AI's `prepare_join_queue`
 * depends on exactly that meaning, and widening it would have changed a
 * refusal into an acceptance somewhere nobody was looking.
 */
export type CatalogueStatus = ShopAvailability | "BY_APPOINTMENT";

export function catalogueStatus(
  shop: Pick<Shop, "is_open"> &
    Partial<Pick<Shop, "accepting_new" | "break_until">> & {
      business_type?: BusinessType | null;
    },
  nowMs: number = Date.now(),
): CatalogueStatus {
  if (isAppointmentModel(shop.business_type)) return "BY_APPOINTMENT";
  return shopAvailability(shop, nowMs);
}

/**
 * Is a shop in the catalogue reachable — worth walking or riding to?
 *
 * Used for the grey pin and the muted card. An appointment shop is always
 * reachable in this sense: you are not turning up, you are booking.
 */
export function isCatalogueAvailable(status: CatalogueStatus): boolean {
  return status === "OPEN" || status === "BREAK" || status === "BY_APPOINTMENT";
}
