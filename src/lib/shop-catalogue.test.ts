import { describe, expect, it } from "vitest";
import {
  ALWAYS_LISTED_BUSINESS_TYPES,
  catalogueOrFilter,
  catalogueStatus,
  isCatalogueAvailable,
  isListedInCatalogue,
} from "./shop-catalogue";
import { shopAvailability } from "./shop-availability";
import type { BusinessType } from "@/types";

const shop = (business_type: BusinessType, is_open: boolean, extra = {}) =>
  ({ business_type, is_open, accepting_new: true, break_until: null, ...extra }) as never;

describe("which shops the catalogue lists", () => {
  it("**lists a parlour whose owner never flipped the open switch**", () => {
    // The bug. `appointment_before_insert` ignores `is_open` on purpose, so
    // this shop will take tomorrow's booking — and the map that leads to it
    // was hiding it.
    expect(isListedInCatalogue(shop("PARLOUR", false))).toBe(true);
  });

  it("still hides a closed salon, because a closed salon really cannot serve you", () => {
    // `serials_before_insert` raises 'shop is not open', so listing it would
    // send somebody to a shut door.
    expect(isListedInCatalogue(shop("SALON", false))).toBe(false);
    expect(isListedInCatalogue(shop("UNISEX", false))).toBe(false);
  });

  it("lists every open shop, whatever it is", () => {
    for (const type of ["SALON", "PARLOUR", "UNISEX"] as const) {
      expect(isListedInCatalogue(shop(type, true)), type).toBe(true);
    }
  });

  it("treats a missing business type as a queue shop, like everything else does", () => {
    expect(isListedInCatalogue({ business_type: null, is_open: false })).toBe(false);
    expect(isListedInCatalogue({ business_type: null, is_open: true })).toBe(true);
  });
});

describe("the query filter and the predicate agree", () => {
  it("names the appointment types and nothing else", () => {
    expect([...ALWAYS_LISTED_BUSINESS_TYPES]).toEqual(["PARLOUR"]);
  });

  it("builds a PostgREST or() that matches `isListedInCatalogue`", () => {
    expect(catalogueOrFilter()).toBe("is_open.eq.true,business_type.eq.PARLOUR");
  });

  it("**the filter accepts exactly the shops the predicate accepts**", () => {
    // A drift between these two is the original bug in a new costume: the
    // query would fetch one set and the client would render another.
    const clauses = catalogueOrFilter().split(",");
    const matchedByFilter = (s: { business_type: BusinessType; is_open: boolean }) =>
      clauses.some((clause) =>
        clause === "is_open.eq.true"
          ? s.is_open
          : clause === `business_type.eq.${s.business_type}`,
      );

    for (const type of ["SALON", "PARLOUR", "UNISEX"] as const) {
      for (const is_open of [true, false]) {
        expect(matchedByFilter({ business_type: type, is_open }), `${type}/${is_open}`).toBe(
          isListedInCatalogue(shop(type, is_open)),
        );
      }
    }
  });
});

describe("what the catalogue says about a shop", () => {
  it("**says 'by appointment' about a parlour, never 'open' or 'closed'**", () => {
    // Otherwise the pin would be grey and the popup would read বন্ধ about a
    // shop that is taking bookings — the same lie as hiding it.
    expect(catalogueStatus(shop("PARLOUR", false))).toBe("BY_APPOINTMENT");
    expect(catalogueStatus(shop("PARLOUR", true))).toBe("BY_APPOINTMENT");
    expect(catalogueStatus(shop("PARLOUR", true, { accepting_new: false }))).toBe(
      "BY_APPOINTMENT",
    );
  });

  it("keeps the queue's own four answers for a salon", () => {
    expect(catalogueStatus(shop("SALON", false))).toBe("CLOSED");
    expect(catalogueStatus(shop("SALON", true))).toBe("OPEN");
    expect(catalogueStatus(shop("SALON", true, { accepting_new: false }))).toBe("NOT_ACCEPTING");
  });

  it("**leaves `shopAvailability` untouched — it is the queue's rule**", () => {
    // `prepare_join_queue` refuses on exactly this, and widening it would have
    // turned a refusal into an acceptance where nobody was looking.
    expect(shopAvailability(shop("PARLOUR", false))).toBe("CLOSED");
  });

  it("counts a parlour as reachable, and a closed salon as not", () => {
    expect(isCatalogueAvailable("BY_APPOINTMENT")).toBe(true);
    expect(isCatalogueAvailable("OPEN")).toBe(true);
    expect(isCatalogueAvailable("BREAK")).toBe(true);
    expect(isCatalogueAvailable("CLOSED")).toBe(false);
    expect(isCatalogueAvailable("NOT_ACCEPTING")).toBe(false);
  });
});
