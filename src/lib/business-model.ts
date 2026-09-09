import type { BusinessType } from "@/types";

/**
 * How a shop takes work in.
 *
 * `QUEUE` — the customer joins a live line and is served when their turn
 * comes. Position, chair assignment and a running ETA are the whole product.
 *
 * `APPOINTMENT` — the customer picks a date and a time slot up front. There is
 * no line to be in, so position and ETA mean nothing.
 *
 * These are genuinely different products, not two skins of one (decision 23):
 * a parlour service runs two to three hours and is planned days ahead, so
 * "turn up in fifteen minutes and sit down" never applies.
 */
export type BookingModel = "QUEUE" | "APPOINTMENT";

/**
 * The one place `business_type` turns into behaviour (decision 27).
 *
 * Exhaustive on purpose: adding a value to the database enum without deciding
 * which model it runs is a compile error here rather than a silent default
 * somewhere in the UI.
 */
const MODEL_BY_TYPE: Record<BusinessType, BookingModel> = {
  SALON: "QUEUE",
  PARLOUR: "APPOINTMENT",
  // UNISEX is a legacy enum value the registration form never offers. The
  // shops that carry it are running the queue today, so that is what it means.
  UNISEX: "QUEUE",
};

/**
 * Resolve a shop's booking model.
 *
 * Nothing in the app should compare `business_type` to `"PARLOUR"` directly —
 * ask this instead, so a third vertical later changes one file rather than
 * every screen that had an opinion.
 *
 * A missing type is the queue. That covers three real cases at once: a shop
 * row that has not loaded yet, an owner who has not created a shop, and a
 * database enum value this deploy predates. Every one of those was a queue
 * before parlours existed, and falling back to the model that is fully built
 * is the safe direction to fail.
 */
export function bookingModel(type: BusinessType | null | undefined): BookingModel {
  if (!type || !(type in MODEL_BY_TYPE)) return "QUEUE";
  return MODEL_BY_TYPE[type];
}

/** Reads better than `bookingModel(x) === "APPOINTMENT"` at call sites. */
export function isAppointmentModel(type: BusinessType | null | undefined): boolean {
  return bookingModel(type) === "APPOINTMENT";
}

/** Reads better than `bookingModel(x) === "QUEUE"` at call sites. */
export function isQueueModel(type: BusinessType | null | undefined): boolean {
  return bookingModel(type) === "QUEUE";
}

/**
 * Pick one of two values by booking model.
 *
 * For the handful of places where the difference is a whole *sentence*, not a
 * noun — "each chair is a lane on the board" versus "each seat is a column on
 * today's schedule". Nouns belong in `business-terms.ts` (decision 28); this
 * is for copy that the terminology layer cannot fix, and it keeps those call
 * sites declarative instead of sprouting `isAppointmentModel(...) ? a : b`
 * ternaries that each have to be found again later.
 *
 * Both branches are required, so adding a model to `BookingModel` is a
 * compile error at every call site rather than a silently missing case.
 */
export function byModel<T>(
  type: BusinessType | null | undefined,
  choices: Record<BookingModel, T>,
): T {
  return choices[bookingModel(type)];
}
