/**
 * Bounds and validation for a loyalty earning rate — "how many taka earn one
 * point".
 *
 * Pure, and in `src/lib` rather than in the admin feature, because three
 * places need the same answer and must not drift:
 *
 *   · the admin form that sets the PLATFORM default
 *   · the provider form that sets a SHOP's own rate
 *   · `platform_settings` and `loyalty_settings`, whose CHECK constraints are
 *     the real authority
 *
 * The numbers below are the constraints', deliberately. A form that accepted a
 * value the database then refused would turn a typo into a stack trace.
 */

/** Below 1, `floor(bill / rate)` is undefined or absurd. */
export const LOYALTY_RATE_MIN = 1;
/** Above this a programme nobody could ever earn from is almost certainly a typo. */
export const LOYALTY_RATE_MAX = 100_000;

export type LoyaltyRateProblem = "required" | "not-integer" | "out-of-range";

/**
 * What is wrong with this rate, or `null` if nothing is.
 *
 * Takes the raw string from the input rather than a number, on purpose: a
 * number-typed field turns a half-typed "" into 0 and then complains about a
 * value nobody entered, which makes "you have not filled this in" and "that is
 * too small" the same message. They are different mistakes and deserve
 * different sentences.
 */
export function validateLoyaltyRate(raw: string): LoyaltyRateProblem | null {
  if (raw.trim() === "") return "required";

  const n = Number(raw);
  if (!Number.isFinite(n)) return "required";
  // Checked before the range so "50.5" reads as "whole numbers only" rather
  // than the misleading "out of range" — half a point cannot be spent.
  if (!Number.isInteger(n)) return "not-integer";
  if (n < LOYALTY_RATE_MIN || n > LOYALTY_RATE_MAX) return "out-of-range";

  return null;
}
