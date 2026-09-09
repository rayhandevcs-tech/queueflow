import { describe, expect, it } from "vitest";
import type { BusinessType } from "@/types";
import { SERVICE_CATEGORY_ICON } from "@/lib/service-category-icon";
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABEL,
  categoriesFor,
  isServiceCategory,
} from "./constants";

describe("SERVICE_CATEGORIES", () => {
  it("keeps every category labelled in both languages and drawn with an icon", () => {
    for (const category of SERVICE_CATEGORIES) {
      expect(SERVICE_CATEGORY_LABEL[category].bn).toBeTruthy();
      expect(SERVICE_CATEGORY_LABEL[category].en).toBeTruthy();
      expect(SERVICE_CATEGORY_ICON[category]).toBeTruthy();
    }
  });

  it("has no duplicates and keeps OTHER last", () => {
    expect(new Set(SERVICE_CATEGORIES).size).toBe(SERVICE_CATEGORIES.length);
    expect(SERVICE_CATEGORIES.at(-1)).toBe("OTHER");
  });

  // The seven the CHECK constraint has allowed since 20260802. If any of these
  // ever left the list, a saved service would fail validation on its next edit.
  it("still contains every category that existed before parlours", () => {
    for (const original of ["HAIRCUT", "SHAVE", "COLOR", "FACIAL", "SPA", "BRIDAL", "OTHER"]) {
      expect(SERVICE_CATEGORIES).toContain(original);
    }
  });

  it("contains the five parlour categories this sprint added", () => {
    for (const added of ["THREADING", "WAXING", "MEHENDI", "MAKEUP", "NAILS"]) {
      expect(SERVICE_CATEGORIES).toContain(added);
    }
  });
});

describe("isServiceCategory", () => {
  it("accepts a known value and rejects everything else", () => {
    expect(isServiceCategory("HAIRCUT")).toBe(true);
    expect(isServiceCategory("MEHENDI")).toBe(true);
    expect(isServiceCategory("TATTOO")).toBe(false);
    expect(isServiceCategory("haircut")).toBe(false);
    expect(isServiceCategory(null)).toBe(false);
    expect(isServiceCategory(undefined)).toBe(false);
    expect(isServiceCategory("")).toBe(false);
  });
});

describe("categoriesFor", () => {
  it("offers a salon its own trade and not the parlour's", () => {
    const salon = categoriesFor("SALON");
    expect(salon).toContain("HAIRCUT");
    expect(salon).toContain("SHAVE");
    expect(salon).not.toContain("MEHENDI");
    expect(salon).not.toContain("THREADING");
  });

  it("offers a parlour the beauty categories but not a barber's shave", () => {
    const parlour = categoriesFor("PARLOUR");
    expect(parlour).toContain("MEHENDI");
    expect(parlour).toContain("WAXING");
    expect(parlour).toContain("MAKEUP");
    expect(parlour).toContain("NAILS");
    expect(parlour).toContain("THREADING");
    expect(parlour).not.toContain("SHAVE");
  });

  it("offers a unisex shop everything, because that is what those shops do", () => {
    expect(categoriesFor("UNISEX")).toEqual([...SERVICE_CATEGORIES]);
  });

  it("falls back to the salon's list for a missing or unknown type", () => {
    const salon = categoriesFor("SALON");
    expect(categoriesFor(null)).toEqual(salon);
    expect(categoriesFor(undefined)).toEqual(salon);
    expect(categoriesFor("CAR_WASH" as BusinessType)).toEqual(salon);
  });

  // The data-safety rule. A salon that tagged something MEHENDI before this
  // sprint existed must not lose it by opening the editor.
  it("keeps a service's existing category even when the trade wouldn't offer it", () => {
    expect(categoriesFor("SALON", "MEHENDI")).toContain("MEHENDI");
    expect(categoriesFor("PARLOUR", "SHAVE")).toContain("SHAVE");
  });

  it("doesn't duplicate a kept category that was already on offer", () => {
    const list = categoriesFor("PARLOUR", "MEHENDI");
    expect(list.filter((c) => c === "MEHENDI")).toHaveLength(1);
  });

  it("ignores a kept value that isn't a category at all", () => {
    expect(categoriesFor("SALON", "NONSENSE")).toEqual(categoriesFor("SALON"));
    expect(categoriesFor("SALON", null)).toEqual(categoriesFor("SALON"));
  });

  it("never offers a category the database check would reject", () => {
    for (const type of ["SALON", "PARLOUR", "UNISEX"] as const) {
      for (const category of categoriesFor(type)) {
        expect(SERVICE_CATEGORIES).toContain(category);
      }
    }
  });
});
