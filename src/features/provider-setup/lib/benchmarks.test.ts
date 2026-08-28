import { describe, expect, it } from "vitest";
import { boundingBox, computeBenchmarks, type NeighbourService } from "./benchmarks";

function svc(o: Partial<NeighbourService> = {}): NeighbourService {
  return {
    shop_id: "shop-1",
    name: "Hair Cutting",
    rate: 100,
    default_duration_min: 30,
    ...o,
  };
}

/** Three distinct shops is the minimum for a bucket to be reported. */
function threeShops(name: string, rates: [number, number, number]) {
  return rates.map((rate, i) => svc({ shop_id: `shop-${i}`, name, rate }));
}

describe("computeBenchmarks", () => {
  it("reports nothing until three distinct shops offer a service", () => {
    expect(computeBenchmarks([svc({ shop_id: "a" }), svc({ shop_id: "b" })])).toEqual([]);
    expect(computeBenchmarks(threeShops("Hair Cutting", [100, 120, 140]))).toHaveLength(1);
  });

  it("counts shops, not rows — one shop listing a service twice is still one", () => {
    const rows = [
      svc({ shop_id: "a", rate: 100 }),
      svc({ shop_id: "a", rate: 120 }),
      svc({ shop_id: "a", rate: 140 }),
    ];
    expect(computeBenchmarks(rows)).toEqual([]);
  });

  it("takes the median rate, not the mean, so one outlier cannot move it", () => {
    const rows = [
      ...threeShops("Hair Cutting", [100, 120, 140]),
      svc({ shop_id: "shop-3", rate: 5000 }),
    ];
    const [benchmark] = computeBenchmarks(rows);

    expect(benchmark.medianRate).toBe(130); // mean would be 1340
    expect(benchmark.maxRate).toBe(5000);
    expect(benchmark.shops).toBe(4);
  });

  it("averages the two middle values for an even count", () => {
    const rows = [
      ...threeShops("Hair Cutting", [100, 120, 140]),
      svc({ shop_id: "shop-3", rate: 160 }),
    ];
    expect(computeBenchmarks(rows)[0].medianRate).toBe(130);
  });

  it("buckets the same service across spelling and case differences", () => {
    const rows = [
      svc({ shop_id: "a", name: "Hair Cutting", rate: 100 }),
      svc({ shop_id: "b", name: "hair cutting", rate: 120 }),
      svc({ shop_id: "c", name: "  Hair   Cutting  ", rate: 140 }),
    ];
    const result = computeBenchmarks(rows);

    expect(result).toHaveLength(1);
    expect(result[0].shops).toBe(3);
  });

  it("ignores rows with a missing or nonsensical price", () => {
    const rows = [
      ...threeShops("Hair Cutting", [100, 120, 140]),
      svc({ shop_id: "shop-3", rate: 0 }),
      svc({ shop_id: "shop-4", rate: -50 }),
      svc({ shop_id: "shop-5", rate: Number.NaN }),
    ];
    expect(computeBenchmarks(rows)[0].shops).toBe(3);
  });

  it("falls back to a sane duration when nobody recorded one", () => {
    const rows = threeShops("Hair Cutting", [100, 120, 140]).map((r) => ({
      ...r,
      default_duration_min: 0,
    }));
    expect(computeBenchmarks(rows)[0].medianDurationMin).toBe(30);
  });

  it("puts the most widely offered service first", () => {
    const rows = [
      ...threeShops("Beard", [70, 80, 90]),
      ...threeShops("Hair Cutting", [100, 120, 140]),
      svc({ shop_id: "shop-3", name: "Hair Cutting", rate: 110 }),
    ];
    expect(computeBenchmarks(rows).map((b) => b.serviceName)).toEqual([
      "Hair Cutting",
      "Beard",
    ]);
  });

  it("returns an empty list for an empty neighbourhood", () => {
    expect(computeBenchmarks([])).toEqual([]);
  });
});

describe("boundingBox", () => {
  it("grows with the radius", () => {
    const small = boundingBox(23.8, 90.4, 1);
    const large = boundingBox(23.8, 90.4, 10);
    expect(large.maxLat - large.minLat).toBeGreaterThan(small.maxLat - small.minLat);
  });

  it("centres on the point given", () => {
    const box = boundingBox(23.8, 90.4, 5);
    expect((box.minLat + box.maxLat) / 2).toBeCloseTo(23.8);
    expect((box.minLon + box.maxLon) / 2).toBeCloseTo(90.4);
  });

  it("covers roughly the right distance in latitude", () => {
    // 1 degree of latitude is about 111 km, everywhere.
    const box = boundingBox(23.8, 90.4, 111);
    expect(box.maxLat - box.minLat).toBeCloseTo(2, 1);
  });

  it("widens longitude away from the equator, where degrees are narrower", () => {
    const dhaka = boundingBox(23.8, 90.4, 5);
    const oslo = boundingBox(59.9, 10.7, 5);
    expect(oslo.maxLon - oslo.minLon).toBeGreaterThan(dhaka.maxLon - dhaka.minLon);
  });

  it("stays finite at the pole instead of dividing by zero", () => {
    const box = boundingBox(90, 0, 5);
    expect(Number.isFinite(box.maxLon)).toBe(true);
  });
});
