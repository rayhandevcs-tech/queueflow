import { distanceKm } from "@/lib/geo";

/**
 * Average door-to-door speed for a short in-city trip in Bangladesh — a blend
 * of walking the first stretch and a rickshaw/CNG/bus for anything longer,
 * through traffic that rarely lets any of them go faster.
 *
 * Deliberately ONE number rather than a walk/ride split: a piecewise model
 * produces a cliff (a 1.2 km walk "taking longer" than a 1.4 km ride), which
 * reads as a bug to anyone who notices it. A single conservative speed keeps
 * the estimate monotonic, and being a few minutes early is the harmless
 * direction to be wrong in.
 */
const CITY_KMH = 12;

/** Getting ready and actually out the door — never zero, however close you live. */
const DOOR_MIN = 3;

const MIN_TRAVEL_MIN = 3;
/** Beyond this the customer isn't "nearby" in any useful sense; matches the DB clamp. */
const MAX_TRAVEL_MIN = 240;

/** Minutes from a straight-line distance in km. */
export function travelMinFromKm(km: number): number {
  if (!Number.isFinite(km) || km < 0) return MIN_TRAVEL_MIN;
  const minutes = Math.round(DOOR_MIN + (km / CITY_KMH) * 60);
  return Math.min(Math.max(minutes, MIN_TRAVEL_MIN), MAX_TRAVEL_MIN);
}

/**
 * Travel estimate between a customer and a shop, or null when either side's
 * coordinates are missing — null means "no leave-now nudge for this booking",
 * which is the correct outcome rather than a guessed one.
 */
export function estimateTravelMin(
  from: { lat: number; lng: number } | null | undefined,
  to: { latitude: number | null; longitude: number | null } | null | undefined,
): number | null {
  if (!from || to?.latitude == null || to?.longitude == null) return null;
  return travelMinFromKm(distanceKm(from.lat, from.lng, to.latitude, to.longitude));
}
