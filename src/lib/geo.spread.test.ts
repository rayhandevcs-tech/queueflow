import { describe, expect, it } from "vitest";
import { distanceKm, spreadOverlapping } from "./geo";

const shop = (id: string, latitude: number, longitude: number) => ({ id, latitude, longitude });

describe("pins that would sit on top of each other get nudged apart", () => {
  it("leaves a lone shop exactly where it is", () => {
    const [only] = spreadOverlapping([shop("a", 23.8103, 90.4125)]);
    expect(only.displayLat).toBe(23.8103);
    expect(only.displayLng).toBe(90.4125);
  });

  it("leaves well-separated shops exactly where they are", () => {
    const out = spreadOverlapping([shop("a", 23.81, 90.41), shop("b", 23.85, 90.45)]);
    for (const s of out) {
      expect(s.displayLat).toBe(s.latitude);
      expect(s.displayLng).toBe(s.longitude);
    }
  });

  it("**separates two shops at identical coordinates**", () => {
    const out = spreadOverlapping([shop("a", 23.8103, 90.4125), shop("b", 23.8103, 90.4125)]);
    expect(out).toHaveLength(2);
    const apart = distanceKm(
      out[0].displayLat, out[0].displayLng,
      out[1].displayLat, out[1].displayLng,
    );
    // Far enough to be two pins, close enough to still be "here".
    expect(apart).toBeGreaterThan(0.02);
    expect(apart).toBeLessThan(0.08);
  });

  it("**never moves a pin further than ~20m from the truth**", () => {
    const out = spreadOverlapping(
      Array.from({ length: 6 }, (_, i) => shop(String(i), 23.8103, 90.4125)),
    );
    for (const s of out) {
      expect(distanceKm(s.latitude, s.longitude, s.displayLat, s.displayLng)).toBeLessThan(0.021);
    }
  });

  it("**keeps the true coordinates on every row** — directions must not drift", () => {
    const out = spreadOverlapping([shop("a", 23.8103, 90.4125), shop("b", 23.8103, 90.4125)]);
    for (const s of out) {
      expect(s.latitude).toBe(23.8103);
      expect(s.longitude).toBe(90.4125);
    }
  });

  it("**drops nobody and invents nobody**", () => {
    const input = [shop("a", 23.81, 90.41), shop("b", 23.81, 90.41), shop("c", 23.9, 90.5)];
    const out = spreadOverlapping(input);
    expect(out).toHaveLength(3);
    expect(new Set(out.map((s) => s.id))).toEqual(new Set(["a", "b", "c"]));
  });

  it("is deterministic — pins must not shuffle between renders", () => {
    const input = [shop("a", 23.81, 90.41), shop("b", 23.81, 90.41)];
    expect(spreadOverlapping(input)).toEqual(spreadOverlapping(input));
  });

  it("copes with an empty list", () => {
    expect(spreadOverlapping([])).toEqual([]);
  });
});
