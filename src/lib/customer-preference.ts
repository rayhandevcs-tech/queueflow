import type { BookingModel } from "./business-model";

/**
 * What kind of place a customer came here for.
 *
 * This is the customer's side of a distinction the app has to keep straight:
 *
 *   · `shops.business_type` — what a **shop** runs. A business fact, the
 *     owner's to set, and the thing `bookingModel()` turns into behaviour.
 *   · `profiles.preferred_business_type` — what a **customer** wants to see
 *     **by default**. A preference, and nothing more.
 *
 * The second one is deliberately powerless over access. It decides which
 * experience opens first — queue-first or appointment-first — and never which
 * shops exist. A customer who picked a parlour can book a salon, and the other
 * way round; if this value ever started filtering a list, "I'd also like a
 * haircut" would mean opening a second account.
 *
 * Everything here is pure, so the rule can be tested without a database, a
 * browser or a session.
 */

export const CUSTOMER_PREFERENCES = ["SALON", "PARLOUR"] as const;

export type CustomerPreference = (typeof CUSTOMER_PREFERENCES)[number];

/**
 * `null` is a real, expected state: every account that existed before Sprint 11
 * has it, because nothing was backfilled. It means "never asked", not "salon".
 */
export type StoredPreference = CustomerPreference | null | undefined;

/**
 * Read an arbitrary value — a profile column, a URL parameter, a form field —
 * as a preference, or as "not set".
 *
 * Strict on purpose. `"salon"` in the wrong case, `"UNISEX"`, `""` and
 * `undefined` all come back `null`, which the rest of the app then treats as
 * "never chosen" and falls back from. A near-miss quietly accepted here would
 * be a value the database's CHECK constraint refuses on the way back in.
 */
export function parsePreference(value: unknown): CustomerPreference | null {
  return value === "SALON" || value === "PARLOUR" ? value : null;
}

/**
 * The booking model a customer's default experience should open on.
 *
 * `QUEUE` for an unset preference, which is the same direction
 * `bookingModel()` fails in and for the same reason: the salon flow is the one
 * that is fully built, so an unknown preference lands somewhere that works
 * rather than somewhere half-finished. It covers three real cases at once — a
 * profile that has not loaded, a legacy account that never chose, and a guest.
 */
export function preferredBookingModel(value: StoredPreference): BookingModel {
  return parsePreference(value) === "PARLOUR" ? "APPOINTMENT" : "QUEUE";
}

/** True when the customer has actually answered the question. */
export function hasChosenPreference(value: StoredPreference): boolean {
  return parsePreference(value) !== null;
}

/**
 * The preference as a shop `business_type` filter value — or null for "show
 * everything".
 *
 * Used only to pick which tab of the explore list opens first. It returns the
 * preference itself rather than a list of allowed types, precisely so that
 * nothing can mistake it for an allow-list: the control it feeds always has an
 * "all" option, and that option is one tap away.
 */
export function defaultExploreFilter(value: StoredPreference): CustomerPreference | null {
  return parsePreference(value);
}

/**
 * Does a shop match a preference?
 *
 * A `UNISEX` shop matches **both**, because that is what unisex means — and
 * because `bookingModel()` already treats it as a queue shop, a salon-
 * preferring customer would expect to find it. This is used for ordering and
 * for the optional explore tab, never to hide a row.
 */
export function shopMatchesPreference(
  shopBusinessType: string | null | undefined,
  preference: StoredPreference,
): boolean {
  const pref = parsePreference(preference);
  if (!pref) return true;
  if (shopBusinessType === "UNISEX") return true;
  return shopBusinessType === pref;
}

/**
 * Stable-sort a shop list so the preferred kind comes first.
 *
 * Ordering, not filtering — the list that comes back has exactly the rows that
 * went in. That is the whole difference between a default and a restriction,
 * and it is why this returns the same length it was given.
 *
 * Copies before sorting: the input belongs to the query cache.
 */
export function sortByPreference<T extends { business_type?: string | null }>(
  shops: readonly T[],
  preference: StoredPreference,
): T[] {
  const pref = parsePreference(preference);
  if (!pref) return [...shops];
  return [...shops]
    .map((shop, index) => ({ shop, index }))
    .sort((a, b) => {
      const am = shopMatchesPreference(a.shop.business_type, pref) ? 0 : 1;
      const bm = shopMatchesPreference(b.shop.business_type, pref) ? 0 : 1;
      // The index tiebreak keeps the caller's own order (distance, rating)
      // intact inside each group — `Array.prototype.sort` is stable in modern
      // engines, but saying so here makes the intent survive a refactor.
      return am - bm || a.index - b.index;
    })
    .map((entry) => entry.shop);
}

/** The three states of the explore type filter. Mirrors `BusinessTypeFilter`. */
export type ExploreTypeFilter = "ALL" | CustomerPreference;

/**
 * What the explore list should be showing.
 *
 * Three inputs collapse into one answer, and the order of precedence is the
 * whole point:
 *
 *   1. what the customer TAPPED, if they tapped anything — a person's own
 *      choice outranks a preference they set months ago at signup
 *   2. otherwise their preferred ecosystem, which is what makes a parlour
 *      customer's home a parlour home
 *   3. otherwise everything, which is what a legacy account with no
 *      preference and every guest gets
 *
 * `choice === null` means "has not touched the chips", which is deliberately
 * NOT the same as having chosen "ALL": the first is a default the preference
 * may fill in, the second is an instruction it must not override.
 *
 * Pure, so the screen does not have to seed state from an async profile read
 * inside an effect — it derives this on every render instead.
 */
export function effectiveTypeFilter(
  choice: ExploreTypeFilter | null,
  preference: StoredPreference,
): ExploreTypeFilter {
  if (choice) return choice;
  return parsePreference(preference) ?? "ALL";
}

/** Is the view the preference's doing rather than the customer's own? */
export function showingPreferenceDefault(
  choice: ExploreTypeFilter | null,
  preference: StoredPreference,
): boolean {
  return choice === null && parsePreference(preference) !== null;
}
