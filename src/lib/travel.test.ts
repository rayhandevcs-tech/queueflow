import { describe, expect, it } from "vitest";
import { estimateTravelMin, travelMinFromKm } from "./travel";

describe("travelMinFromKm", () => {
  it("never returns less than the door-time floor, even next door", () => {
    expect(travelMinFromKm(0)).toBe(3);
    expect(travelMinFromKm(0.05)).toBe(3);
  });

  it("grows monotonically with distance", () => {
    const points = [0, 0.5, 1, 1.2, 1.4, 3, 5, 10].map(travelMinFromKm);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeGreaterThanOrEqual(points[i - 1]);
    }
  });

  it("produces plausible city numbers", () => {
    // 3 km through Dhaka traffic is a ~20 minute trip, not a 5 minute one.
    expect(travelMinFromKm(3)).toBeGreaterThanOrEqual(15);
    expect(travelMinFromKm(3)).toBeLessThanOrEqual(25);
  });

  it("clamps absurd distances instead of promising a 3-hour nudge", () => {
    expect(travelMinFromKm(10_000)).toBe(240);
  });

  it("falls back to the floor on junk input", () => {
    expect(travelMinFromKm(Number.NaN)).toBe(3);
    expect(travelMinFromKm(-5)).toBe(3);
  });
});

describe("estimateTravelMin", () => {
  const shop = { latitude: 23.8103, longitude: 90.4125 };

  it("returns null when we don't know where the customer is", () => {
    expect(estimateTravelMin(null, shop)).toBeNull();
    expect(estimateTravelMin(undefined, shop)).toBeNull();
  });

  it("returns null when the shop has no pin on the map", () => {
    expect(
      estimateTravelMin({ lat: 23.81, lng: 90.41 }, { latitude: null, longitude: null }),
    ).toBeNull();
  });

  it("estimates from real coordinates", () => {
    // ~1 km north of the shop.
    const minutes = estimateTravelMin({ lat: 23.8193, lng: 90.4125 }, shop);
    expect(minutes).not.toBeNull();
    expect(minutes!).toBeGreaterThan(3);
    expect(minutes!).toBeLessThan(20);
  });
});
