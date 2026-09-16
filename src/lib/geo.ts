const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in kilometers. */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Nudge pins apart when several shops sit on effectively the same spot.
 *
 * Two shops in the same building, or two rows typed with the same rounded
 * coordinates, land one exactly on top of the other. The one underneath cannot
 * be seen, cannot be tapped, and gives no hint that it is there — so the map
 * silently under-reports how many shops are nearby.
 *
 * Real map libraries solve this by spiderfying on click. That needs a
 * clustering plugin, and this project does not add a dependency for a visual
 * nicety (decision 6). So: group by coordinate, and for any group with more
 * than one member, fan them onto a small circle around the shared point.
 *
 * **This deliberately draws a pin a few metres from the truth**, which is a
 * trade worth naming. The offset is ~18m at its largest — smaller than the
 * building most of these shops are in — it only ever applies when the pins
 * would otherwise be indistinguishable, and the true coordinates are still
 * what the popup's directions link uses. A pin you can see and tap 18m out
 * beats a pin that is perfectly placed and invisible.
 *
 * Deterministic: the same input gives the same output, so pins do not shuffle
 * between renders or after a refetch. Pure, so it can be tested without a map.
 */
export function spreadOverlapping<T extends { latitude: number; longitude: number }>(
  items: readonly T[],
): Array<T & { displayLat: number; displayLng: number }> {
  // ~11m of latitude. Coarse enough to catch "same building" and two rows
  // rounded to four decimals; fine enough not to merge neighbours.
  const PRECISION = 1e-4;
  const OFFSET_DEG = 1.6e-4;

  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = `${Math.round(item.latitude / PRECISION)}:${Math.round(item.longitude / PRECISION)}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const out: Array<T & { displayLat: number; displayLng: number }> = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0];
      out.push({ ...only, displayLat: only.latitude, displayLng: only.longitude });
      continue;
    }

    group.forEach((item, index) => {
      // Start at -90° so a pair separates left/right rather than up/down —
      // a pin's point is at its bottom, so vertical neighbours still overlap
      // where horizontal ones do not.
      const angle = (index / group.length) * 2 * Math.PI - Math.PI / 2;
      // Longitude degrees shrink with latitude; without the cosine the fan
      // would be an ellipse squashed the wrong way at Dhaka's 23.8°N.
      const lngScale = Math.cos(toRad(item.latitude)) || 1;
      out.push({
        ...item,
        displayLat: item.latitude + OFFSET_DEG * Math.sin(angle),
        displayLng: item.longitude + (OFFSET_DEG * Math.cos(angle)) / lngScale,
      });
    });
  }

  return out;
}
