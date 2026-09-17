import { describe, expect, it } from "vitest";
import {
  matchesRoute,
  providerNavSections,
  sectionForPath,
  type ProviderNavSection,
} from "./provider-nav-items";
import { PROVIDER_PREFIXES, startsWithAny } from "@/lib/supabase/middleware";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";

const MODELS = ["QUEUE", "APPOINTMENT"] as const;

/** Every destination the sidebar offers, section rows and tabs together. */
function allHrefs(sections: ReadonlyArray<ProviderNavSection>): string[] {
  return sections.flatMap((section) =>
    section.tabs.length > 0 ? section.tabs.map((tab) => tab.href) : [section.href],
  );
}

describe("the grouped sidebar", () => {
  it("**is twelve rows for a salon, not twenty-one**", () => {
    // The whole point of the change. A menu past about a dozen entries stops
    // being read and starts being scanned twice.
    expect(providerNavSections("QUEUE")).toHaveLength(12);
  });

  it("gives a parlour one more row, for its appointment register", () => {
    expect(providerNavSections("APPOINTMENT")).toHaveLength(13);
  });

  it("**offers `/appointments` to a parlour and to nobody else**", () => {
    expect(allHrefs(providerNavSections("APPOINTMENT"))).toContain("/appointments");
    expect(allHrefs(providerNavSections("QUEUE"))).not.toContain("/appointments");
  });

  it("**still reaches all twenty-one screens**", () => {
    // Grouping a menu must not lose a destination. Every route that had a
    // sidebar row before is still reachable — six of them as tabs now.
    const hrefs = new Set(allHrefs(providerNavSections("APPOINTMENT")));
    for (const href of [
      "/dashboard",
      "/appointments",
      "/chairs",
      "/services",
      "/offers",
      "/memberships",
      "/loyalty",
      "/referrals",
      "/rewards",
      "/chat",
      "/income",
      "/cashbook",
      "/manual-entries",
      "/due-ledger",
      "/ai",
      "/analytics",
      "/regulars",
      "/notifications/send",
      "/reviews",
      "/settings",
    ]) {
      expect(hrefs, href).toContain(href);
    }
  });

  it("lists no destination twice", () => {
    for (const model of MODELS) {
      const hrefs = allHrefs(providerNavSections(model));
      expect(new Set(hrefs).size, model).toBe(hrefs.length);
    }
  });

  it("points each section row at its own first tab", () => {
    // Otherwise tapping "Loyalty & rewards" would land somewhere the tab strip
    // does not highlight, and the strip would look broken on arrival.
    for (const model of MODELS) {
      for (const section of providerNavSections(model)) {
        if (section.tabs.length > 0) {
          expect(section.href, section.id).toBe(section.tabs[0].href);
        }
      }
    }
  });

  it("gives every section an icon and a resolvable label", () => {
    for (const model of MODELS) {
      for (const section of providerNavSections(model)) {
        expect(section.icon, section.id).toBeTruthy();
        expect(section.label.key, section.id).toBeTruthy();
        // A dict label must actually exist in the dictionary — a typo here
        // would throw at render time and nothing else would catch it.
        if (section.label.kind === "dict" || section.label.kind === "dictWithChair") {
          expect(providerCatalogDict, section.id).toHaveProperty(section.label.key);
        }
        for (const tab of section.tabs) {
          if (tab.label.kind === "dict" || tab.label.kind === "dictWithChair") {
            expect(providerCatalogDict, tab.href).toHaveProperty(tab.label.key);
          }
        }
      }
    }
  });

  it("names every group label in both languages", () => {
    for (const key of [
      "navCatalogueGroup",
      "navMembershipGroup",
      "navLoyaltyGroup",
      "navMoneyGroup",
      "navCustomersGroup",
    ] as const) {
      expect(providerCatalogDict[key].bn, key).toBeTruthy();
      expect(providerCatalogDict[key].en, key).toBeTruthy();
    }
  });

  it("**builds the catalogue label from the shop's own word for a chair**", () => {
    // A parlour has সিট, not চেয়ার. The label is a function precisely so the
    // group heading follows the same vocabulary the page below it uses.
    const bn = providerCatalogDict.navCatalogueGroup.bn;
    const en = providerCatalogDict.navCatalogueGroup.en;
    expect(bn("চেয়ার")).toBe("চেয়ার ও সার্ভিস");
    expect(bn("সিট")).toBe("সিট ও সার্ভিস");
    expect(en("Chair")).toBe("Chairs & services");
    expect(en("Seat")).toBe("Seats & services");
  });

  it("returns a fresh list, so a caller cannot mutate the nav for everyone", () => {
    expect(providerNavSections("QUEUE")).not.toBe(providerNavSections("QUEUE"));
    expect(providerNavSections("QUEUE")).toEqual(providerNavSections("QUEUE"));
  });
});

describe("what got grouped with what", () => {
  const sections = providerNavSections("QUEUE");
  const tabsOf = (id: string) =>
    sections.find((section) => section.id === id)?.tabs.map((tab) => tab.href);

  it("**puts offers inside membership**", () => {
    expect(tabsOf("membership")).toEqual(["/memberships", "/offers"]);
  });

  it("**puts chairs and the service list in one place**", () => {
    expect(tabsOf("catalogue")).toEqual(["/chairs", "/services"]);
  });

  it("**keeps loyalty, referral and rewards together**", () => {
    expect(tabsOf("loyalty")).toEqual(["/loyalty", "/referrals", "/rewards"]);
  });

  it("**puts the due ledger inside income**", () => {
    expect(tabsOf("money")).toEqual(["/income", "/due-ledger"]);
  });

  it("**keeps reviews, broadcasts and regulars together**", () => {
    expect(tabsOf("customers")).toEqual([
      "/reviews",
      "/notifications/send",
      "/regulars",
    ]);
  });

  it("leaves the single-screen sections alone", () => {
    for (const id of ["board", "chat", "cashbook", "manual-entries", "ai", "analytics", "settings"]) {
      expect(tabsOf(id), id).toEqual([]);
    }
  });
});

describe("badges", () => {
  it("**moves the due badge onto the section row that now owns it**", () => {
    // `/due-ledger` is a tab, so a badge left on that row would have vanished
    // from the sidebar entirely — and being seen without navigating is the
    // badge's only job.
    const money = providerNavSections("QUEUE").find((s) => s.id === "money");
    expect(money?.badge).toBe("due");
  });

  it("counts the live queue for a salon and not for a parlour", () => {
    // A parlour has no line, so the count would sit at 0 forever.
    expect(providerNavSections("QUEUE").find((s) => s.id === "board")?.badge).toBe("queue");
    expect(
      providerNavSections("APPOINTMENT").find((s) => s.id === "board")?.badge,
    ).toBeUndefined();
  });

  it("keeps the chat badge on chat", () => {
    expect(providerNavSections("QUEUE").find((s) => s.id === "chat")?.badge).toBe("chat");
  });

  it("puts a badge on nothing else", () => {
    for (const model of MODELS) {
      const badged = providerNavSections(model)
        .filter((section) => section.badge)
        .map((section) => section.id);
      expect(new Set(badged), model).toEqual(
        new Set(model === "QUEUE" ? ["board", "chat", "money"] : ["chat", "money"]),
      );
    }
  });
});

describe("matchesRoute", () => {
  it("matches the path itself and its children", () => {
    expect(matchesRoute("/chairs", "/chairs")).toBe(true);
    expect(matchesRoute("/chairs/abc", "/chairs")).toBe(true);
  });

  it("**does not match a sibling that merely starts with the same letters**", () => {
    // The old sidebar used a bare `startsWith`, which was harmless while every
    // route was one word and is not now that `/notifications/send` is in the
    // list.
    expect(matchesRoute("/chairs-archive", "/chairs")).toBe(false);
    expect(matchesRoute("/notifications", "/notifications/send")).toBe(false);
  });
});

describe("sectionForPath", () => {
  const sections = providerNavSections("QUEUE");
  const idFor = (path: string) => sectionForPath(sections, path)?.id ?? null;

  it("**highlights the section a tab belongs to**", () => {
    // Without this, `/offers` would highlight nothing: its own row is gone.
    expect(idFor("/offers")).toBe("membership");
    expect(idFor("/services")).toBe("catalogue");
    expect(idFor("/rewards")).toBe("loyalty");
    expect(idFor("/due-ledger")).toBe("money");
    expect(idFor("/regulars")).toBe("customers");
  });

  it("finds a single-screen section too", () => {
    expect(idFor("/dashboard")).toBe("board");
    expect(idFor("/settings")).toBe("settings");
  });

  it("follows a child route to its parent's section", () => {
    expect(idFor("/chat/some-customer-id")).toBe("chat");
  });

  it("**prefers the more specific route when two could match**", () => {
    expect(idFor("/notifications/send")).toBe("customers");
  });

  it("returns null for a route the sidebar does not own", () => {
    // `/account` and `/help` sit in the footer, `/payment-methods` redirects.
    expect(idFor("/account")).toBeNull();
    expect(idFor("/help")).toBeNull();
    expect(idFor("/payment-methods")).toBeNull();
  });

  it("does not claim a parlour-only route for a salon", () => {
    expect(idFor("/appointments")).toBeNull();
    expect(
      sectionForPath(providerNavSections("APPOINTMENT"), "/appointments")?.id,
    ).toBe("appointments");
  });
});

describe("every sidebar destination is behind the provider gate", () => {
  it("**guards the three routes the middleware had never listed**", () => {
    // Found while grouping the nav: the sidebar had always linked these and
    // `PROVIDER_PREFIXES` had never covered them, so a customer following a
    // stale link got a shop-management screen rendered empty.
    expect(startsWithAny("/offers", PROVIDER_PREFIXES)).toBe(true);
    expect(startsWithAny("/chat", PROVIDER_PREFIXES)).toBe(true);
    expect(startsWithAny("/notifications/send", PROVIDER_PREFIXES)).toBe(true);
  });

  it("guards every href the sidebar offers", () => {
    const hrefs = new Set([
      ...allHrefs(providerNavSections("QUEUE")),
      ...allHrefs(providerNavSections("APPOINTMENT")),
    ]);
    for (const href of hrefs) {
      expect(startsWithAny(href, PROVIDER_PREFIXES), href).toBe(true);
    }
  });

  it("**leaves the customer's notification inbox to the customer**", () => {
    // Only `/notifications/send` is the shop's. `/notifications` itself is the
    // customer's inbox, and gating it to providers would lock every customer
    // out of their own notifications.
    expect(startsWithAny("/notifications", PROVIDER_PREFIXES)).toBe(false);
  });
});
