/**
 * Last known customer coordinates, shared across features via localStorage.
 *
 * Why not just call geolocation again at booking time: the booking screen is
 * the worst possible moment to raise a permission dialog — the customer has
 * their finger on "confirm", and a prompt there either blocks the booking or
 * gets dismissed. Explore already asks (with a proper explanation), so the
 * booking flow reuses that answer.
 *
 * Device-local and deliberately short-lived: a stale fix would produce a
 * "leave now" nudge measured from where the customer was this morning.
 */
const KEY = "qf.lastLocation";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface Coords {
  lat: number;
  lng: number;
}

interface Stored extends Coords {
  at: number;
}

export function rememberLocation(coords: Coords): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Stored = { ...coords, at: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota — the nudge is a bonus, never a blocker.
  }
}

export function readRememberedLocation(): Coords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (
      typeof parsed?.lat !== "number" ||
      typeof parsed?.lng !== "number" ||
      typeof parsed?.at !== "number" ||
      Date.now() - parsed.at > MAX_AGE_MS
    ) {
      return null;
    }
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}
