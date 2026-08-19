import { describe, expect, it } from "vitest";
import { fitDimensions, formatMb, IMAGE_PRESETS, shouldSkipCompression } from "./image-compress";

describe("fitDimensions", () => {
  it("leaves an image already within the limit alone", () => {
    expect(fitDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("never scales a small image up", () => {
    expect(fitDimensions(120, 90, 1600)).toEqual({ width: 120, height: 90 });
  });

  it("scales by the longest edge, whichever it is", () => {
    expect(fitDimensions(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitDimensions(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("keeps the aspect ratio of an extreme panorama", () => {
    const { width, height } = fitDimensions(6000, 500, 1600);
    expect(width).toBe(1600);
    expect(height).toBe(Math.round((500 / 6000) * 1600));
  });

  it("never rounds a dimension down to zero", () => {
    expect(fitDimensions(8000, 3, 512).height).toBe(1);
  });

  it("returns whole pixels", () => {
    const { width, height } = fitDimensions(1333, 999, 500);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
  });

  it("survives a zero-sized image instead of dividing by it", () => {
    expect(fitDimensions(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });

  it("brings a typical phone photo under every preset's ceiling", () => {
    for (const preset of Object.values(IMAGE_PRESETS)) {
      const { width, height } = fitDimensions(4032, 3024, preset.maxDimension);
      expect(Math.max(width, height)).toBeLessThanOrEqual(preset.maxDimension);
    }
  });
});

describe("shouldSkipCompression", () => {
  it("skips GIFs — a canvas would keep only the first frame", () => {
    expect(shouldSkipCompression("image/gif")).toBe(true);
  });

  it("skips SVGs rather than rasterising them", () => {
    expect(shouldSkipCompression("image/svg+xml")).toBe(true);
  });

  it("compresses the formats a camera actually produces", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(shouldSkipCompression(type)).toBe(false);
    }
  });
});

describe("formatMb", () => {
  it("gives one decimal for small sizes and none for large", () => {
    expect(formatMb(2.5 * 1024 * 1024)).toBe("2.5");
    expect(formatMb(40 * 1024 * 1024)).toBe("40");
  });
});

describe("presets", () => {
  it("orders sizes the way the screens use them", () => {
    expect(IMAGE_PRESETS.avatar.maxDimension).toBeLessThan(IMAGE_PRESETS.tile.maxDimension);
    expect(IMAGE_PRESETS.tile.maxDimension).toBeLessThan(IMAGE_PRESETS.wide.maxDimension);
  });

  it("keeps every ceiling well under the old 2 MB gate", () => {
    for (const preset of Object.values(IMAGE_PRESETS)) {
      expect(preset.maxBytes).toBeLessThanOrEqual(1024 * 1024);
      expect(preset.quality).toBeGreaterThan(0.5);
      expect(preset.quality).toBeLessThanOrEqual(1);
    }
  });
});
