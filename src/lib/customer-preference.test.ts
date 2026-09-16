import { describe, expect, it } from "vitest";
import {
  CUSTOMER_PREFERENCES,
  defaultExploreFilter,
  hasChosenPreference,
  parsePreference,
  preferredBookingModel,
  shopMatchesPreference,
  sortByPreference,
  type CustomerPreference,
  effectiveTypeFilter,
  filterByPreference,
} from "./customer-preference";

describe("parsePreference", () => {
  it("accepts the two values the database accepts", () => {
    expect(parsePreference("SALON")).toBe("SALON");
    expect(parsePreference("PARLOUR")).toBe("PARLOUR");
    expect(CUSTOMER_PREFERENCES).toEqual(["SALON", "PARLOUR"]);
  });

  it("**refuses UNISEX** — a shop can be unisex, a customer cannot prefer it", () => {
    expect(parsePreference("UNISEX")).toBeNull();
  });

  it("is strict about case and whitespace, because the CHECK constraint is", () => {
    expect(parsePreference("salon")).toBeNull();
    expect(parsePreference("Parlour")).toBeNull();
    expect(parsePreference(" SALON ")).toBeNull();
  });

  it("reads every flavour of missing as not-set", () => {
    expect(parsePreference(null)).toBeNull();
    expect(parsePreference(undefined)).toBeNull();
    expect(parsePreference("")).toBeNull();
    expect(parsePreference(0)).toBeNull();
    expect(parsePreference({})).toBeNull();
  });
});

describe("preferredBookingModel — the legacy fallback", () => {
  it("opens a salon customer on the queue", () => {
    expect(preferredBookingModel("SALON")).toBe("QUEUE");
  });

  it("opens a parlour customer on appointments", () => {
    expect(preferredBookingModel("PARLOUR")).toBe("APPOINTMENT");
  });

  it("**falls back to the queue for a legacy account that never chose**", () => {
    // Every account created before Sprint 11 is in this state: the column was
    // added nullable and nothing was backfilled, so `null` means "never
    // asked" — not "salon". The app still has to open on something, and the
    // salon flow is the one that is complete.
    expect(preferredBookingModel(null)).toBe("QUEUE");
    expect(preferredBookingModel(undefined)).toBe("QUEUE");
  });

  it("falls back for a value the database could never have stored", () => {
    expect(preferredBookingModel("UNISEX" as unknown as CustomerPreference)).toBe("QUEUE");
    expect(preferredBookingModel("" as unknown as CustomerPreference)).toBe("QUEUE");
  });

  it("never throws, whatever it is handed", () => {
    for (const value of [null, undefined, "", "x", 1, {}, []] as unknown[]) {
      expect(() => preferredBookingModel(value as CustomerPreference)).not.toThrow();
    }
  });
});

describe("hasChosenPreference", () => {
  it("separates a real answer from an absent one", () => {
    expect(hasChosenPreference("SALON")).toBe(true);
    expect(hasChosenPreference("PARLOUR")).toBe(true);
    expect(hasChosenPreference(null)).toBe(false);
    expect(hasChosenPreference(undefined)).toBe(false);
  });
});

describe("defaultExploreFilter", () => {
  it("opens the list on the customer's own kind", () => {
    expect(defaultExploreFilter("PARLOUR")).toBe("PARLOUR");
  });

  it("**opens on everything when nothing was chosen**", () => {
    expect(defaultExploreFilter(null)).toBeNull();
  });
});

describe("shopMatchesPreference", () => {
  it("matches like for like", () => {
    expect(shopMatchesPreference("SALON", "SALON")).toBe(true);
    expect(shopMatchesPreference("PARLOUR", "PARLOUR")).toBe(true);
    expect(shopMatchesPreference("PARLOUR", "SALON")).toBe(false);
    expect(shopMatchesPreference("SALON", "PARLOUR")).toBe(false);
  });

  it("**counts a unisex shop for both** — that is what unisex means", () => {
    expect(shopMatchesPreference("UNISEX", "SALON")).toBe(true);
    expect(shopMatchesPreference("UNISEX", "PARLOUR")).toBe(true);
  });

  it("matches everything when there is no preference", () => {
    expect(shopMatchesPreference("SALON", null)).toBe(true);
    expect(shopMatchesPreference("PARLOUR", null)).toBe(true);
    expect(shopMatchesPreference(null, null)).toBe(true);
  });

  it("does not match an unknown shop type against a real preference", () => {
    // A deploy ahead of a migration, or a third vertical later: unknown is
    // not silently "yes", it just sorts second.
    expect(shopMatchesPreference("CLINIC", "SALON")).toBe(false);
    expect(shopMatchesPreference(null, "SALON")).toBe(false);
  });
});

describe("sortByPreference — a default, not a filter", () => {
  const shops = [
    { id: "a", business_type: "SALON" },
    { id: "b", business_type: "PARLOUR" },
    { id: "c", business_type: "UNISEX" },
    { id: "d", business_type: "PARLOUR" },
    { id: "e", business_type: "SALON" },
  ];

  it("**keeps every shop** — the list that comes out is the list that went in", () => {
    // This is the whole point of A6: the preference must never become an
    // access restriction. Same length, same ids, only a different order.
    for (const pref of ["SALON", "PARLOUR", null] as const) {
      const sorted = sortByPreference(shops, pref);
      expect(sorted).toHaveLength(shops.length);
      expect([...sorted.map((s) => s.id)].sort()).toEqual(["a", "b", "c", "d", "e"]);
    }
  });

  it("puts the preferred kind first, unisex included", () => {
    expect(sortByPreference(shops, "PARLOUR").map((s) => s.id)).toEqual([
      "b",
      "c",
      "d",
      "a",
      "e",
    ]);
    expect(sortByPreference(shops, "SALON").map((s) => s.id)).toEqual([
      "a",
      "c",
      "e",
      "b",
      "d",
    ]);
  });

  it("**preserves the caller's own order inside each group**", () => {
    // Explore has already sorted by distance; a preference must not scramble
    // that, only group it.
    const sorted = sortByPreference(shops, "PARLOUR");
    expect(sorted.filter((s) => s.business_type === "PARLOUR").map((s) => s.id)).toEqual([
      "b",
      "d",
    ]);
    expect(sorted.filter((s) => s.business_type === "SALON").map((s) => s.id)).toEqual([
      "a",
      "e",
    ]);
  });

  it("leaves the order untouched when there is no preference", () => {
    expect(sortByPreference(shops, null).map((s) => s.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("does not mutate the array it was given", () => {
    const input = [...shops];
    sortByPreference(input, "PARLOUR");
    expect(input.map((s) => s.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("handles an empty list and a shop with no type", () => {
    expect(sortByPreference([], "SALON")).toEqual([]);
    expect(sortByPreference([{ id: "x", business_type: null }], "SALON")).toHaveLength(1);
  });
});

describe("the explore list opens on the customer's own ecosystem", () => {
  it("**a parlour customer's home shows parlours by default**", () => {
    expect(effectiveTypeFilter(null, "PARLOUR")).toBe("PARLOUR");
  });

  it("**a salon customer's home shows salons by default**", () => {
    expect(effectiveTypeFilter(null, "SALON")).toBe("SALON");
  });

  it("a legacy account with no preference still gets everything", () => {
    expect(effectiveTypeFilter(null, null)).toBe("ALL");
    expect(effectiveTypeFilter(null, undefined)).toBe("ALL");
  });

  it("junk in the column does not change the view", () => {
    // Cast the way the rest of this file does: these are values the column's
    // CHECK constraint forbids, so the type is right to reject them — but the
    // function still has to cope if one ever arrives.
    const junk = (v: string) => v as unknown as CustomerPreference;
    expect(effectiveTypeFilter(null, junk("UNISEX"))).toBe("ALL");
    expect(effectiveTypeFilter(null, junk("salon"))).toBe("ALL");
    expect(effectiveTypeFilter(null, junk(""))).toBe("ALL");
  });

  it("**a tap always beats a preference**", () => {
    // The whole point of keeping "untouched" distinct from "chose ALL".
    expect(effectiveTypeFilter("ALL", "PARLOUR")).toBe("ALL");
    expect(effectiveTypeFilter("SALON", "PARLOUR")).toBe("SALON");
    expect(effectiveTypeFilter("PARLOUR", "SALON")).toBe("PARLOUR");
  });

  it("**cross-type discovery stays one tap away, never removed**", () => {
    // A parlour customer who asks for salons gets salons. If this ever fails,
    // the preference has stopped being a default and become a restriction.
    expect(effectiveTypeFilter("SALON", "PARLOUR")).toBe("SALON");
    expect(effectiveTypeFilter("ALL", "SALON")).toBe("ALL");
  });

});

describe("the ecosystem gate — a preference now REMOVES the other kind", () => {
  const salon = { id: "s", business_type: "SALON" };
  const parlour = { id: "p", business_type: "PARLOUR" };
  const unisex = { id: "u", business_type: "UNISEX" };
  const unknown = { id: "x", business_type: null };
  const all = [salon, parlour, unisex, unknown];

  it("**a salon customer sees no parlour at all**", () => {
    const out = filterByPreference(all, "SALON");
    expect(out.map((s) => s.id)).not.toContain("p");
  });

  it("**a parlour customer sees no salon at all**", () => {
    const out = filterByPreference(all, "PARLOUR");
    expect(out.map((s) => s.id)).toEqual(["p"]);
  });

  it("a unisex shop counts as a salon, because it runs the queue", () => {
    // `bookingModel("UNISEX")` has always been QUEUE. Handing a unisex shop to
    // a parlour customer would drop them into a queue they did not ask for.
    expect(filterByPreference(all, "SALON").map((s) => s.id)).toContain("u");
    expect(filterByPreference(all, "PARLOUR").map((s) => s.id)).not.toContain("u");
  });

  it("an unknown or missing type falls in with the salons, like bookingModel", () => {
    expect(filterByPreference(all, "SALON").map((s) => s.id)).toContain("x");
    expect(filterByPreference(all, "PARLOUR").map((s) => s.id)).not.toContain("x");
  });

  it("**a legacy account with no preference still sees everything**", () => {
    expect(filterByPreference(all, null)).toHaveLength(4);
    expect(filterByPreference(all, undefined)).toHaveLength(4);
  });

  it("junk in the column does not hide the whole platform", () => {
    // The failure mode to avoid: an unrecognised value narrowing to nothing
    // and the customer seeing an empty app.
    expect(filterByPreference(all, "UNISEX" as unknown as CustomerPreference)).toHaveLength(4);
    expect(filterByPreference(all, "" as unknown as CustomerPreference)).toHaveLength(4);
  });

  it("preserves the caller's order, so a distance sort survives the gate", () => {
    const ordered = [unisex, salon, unknown];
    expect(filterByPreference(ordered, "SALON").map((s) => s.id)).toEqual(["u", "s", "x"]);
  });

  it("copes with an empty list and never mutates its input", () => {
    expect(filterByPreference([], "SALON")).toEqual([]);
    const input = [...all];
    filterByPreference(input, "PARLOUR");
    expect(input).toHaveLength(4);
  });
});
