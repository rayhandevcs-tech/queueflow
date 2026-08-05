import type { Shop } from "@/types";

/**
 * A shop's bookability, collapsed to one value.
 *
 * `is_open` used to be the whole story, which forced owners into a bad choice
 * at closing time: stay "open" and keep taking serials they can't serve, or
 * close and vanish from Explore while people are still waiting inside. The two
 * softer states fix exactly that.
 *
 * Order matters — closed beats everything, and "not taking new bookings" is
 * reported ahead of a break because it's the one that actually blocks the
 * button. A break is surfaced alongside via `breakMinutesLeft`.
 */
export type ShopAvailability = "CLOSED" | "NOT_ACCEPTING" | "BREAK" | "OPEN";

/**
 * Tolerates the pre-migration shape (columns absent → treated as a normally
 * open shop), so a deploy that lands before the SQL does can't black out
 * anyone's booking button.
 */
type AvailabilityInput = Pick<Shop, "is_open"> &
  Partial<Pick<Shop, "accepting_new" | "break_until">>;

export function breakMinutesLeft(
  shop: AvailabilityInput | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!shop?.break_until) return 0;
  const endsAt = new Date(shop.break_until).getTime();
  if (!Number.isFinite(endsAt) || endsAt <= nowMs) return 0;
  return Math.ceil((endsAt - nowMs) / 60_000);
}

export function shopAvailability(
  shop: AvailabilityInput | null | undefined,
  nowMs: number = Date.now(),
): ShopAvailability {
  if (!shop || !shop.is_open) return "CLOSED";
  if ((shop.accepting_new ?? true) === false) return "NOT_ACCEPTING";
  if (breakMinutesLeft(shop, nowMs) > 0) return "BREAK";
  return "OPEN";
}

/** Can a customer take a serial right now? A break doesn't stop them — it just pushes their ETA. */
export function canBookNow(
  shop: AvailabilityInput | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const state = shopAvailability(shop, nowMs);
  return state === "OPEN" || state === "BREAK";
}
