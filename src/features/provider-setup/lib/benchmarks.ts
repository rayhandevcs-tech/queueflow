import type { PriceBenchmark } from "./prompt";

/**
 * What shops nearby actually charge.
 *
 * This is the whole point of the setup assistant. A model asked to price a
 * haircut in Bangladesh will produce a plausible number from nowhere, and a new
 * owner who trusts it either undercuts themselves for months or prices out
 * their own street. These figures come from real rows in our own database,
 * which is data no general-purpose model has.
 *
 * Pure, so the statistics can be checked without a database.
 */

/** Below this, a "median" is one or two shops' opinion, not a market rate. */
const MIN_SHOPS_FOR_BENCHMARK = 3;
/** Enough to price a catalogue; more would just be prompt weight. */
const MAX_BENCHMARKS = 20;

export interface NeighbourService {
  shop_id: string;
  name: string;
  rate: number;
  default_duration_min: number;
}

/** Same service under different spellings should land in the same bucket. */
function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function computeBenchmarks(rows: readonly NeighbourService[]): PriceBenchmark[] {
  const buckets = new Map<
    string,
    { displayName: string; shops: Set<string>; rates: number[]; durations: number[] }
  >();

  for (const row of rows) {
    if (!Number.isFinite(row.rate) || row.rate <= 0) continue;
    const key = normalise(row.name);
    if (!key) continue;

    let bucket = buckets.get(key);
    if (!bucket) {
      // First spelling seen wins the display name — arbitrary but stable, and
      // the model only needs to recognise the service, not match it exactly.
      bucket = { displayName: row.name.trim(), shops: new Set(), rates: [], durations: [] };
      buckets.set(key, bucket);
    }

    bucket.shops.add(row.shop_id);
    bucket.rates.push(row.rate);
    if (Number.isFinite(row.default_duration_min) && row.default_duration_min > 0) {
      bucket.durations.push(row.default_duration_min);
    }
  }

  return [...buckets.values()]
    // One shop offering a service three times is not three shops agreeing on a
    // price. The threshold counts distinct shops for exactly that reason.
    .filter((b) => b.shops.size >= MIN_SHOPS_FOR_BENCHMARK)
    .map((b) => ({
      serviceName: b.displayName,
      shops: b.shops.size,
      medianRate: median(b.rates),
      minRate: Math.min(...b.rates),
      maxRate: Math.max(...b.rates),
      medianDurationMin: b.durations.length ? median(b.durations) : 30,
    }))
    // Most widely offered first: those are the services a new shop most needs
    // priced right, and the ones whose median is best supported.
    .sort((a, b) => b.shops - a.shops)
    .slice(0, MAX_BENCHMARKS);
}

/**
 * Rough bounding box for a radius in km around a point.
 *
 * A box rather than a great-circle distance because this feeds a SQL range
 * filter on two indexed columns, and at these radii the corner error is a few
 * hundred metres — irrelevant when the question is "what do shops around here
 * charge".
 */
export function boundingBox(lat: number, lon: number, radiusKm: number) {
  const latDelta = radiusKm / 111;
  // Longitude degrees shrink toward the poles; the clamp stops a division by
  // ~zero from producing an infinite box near them.
  const lonDelta = radiusKm / (111 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}
