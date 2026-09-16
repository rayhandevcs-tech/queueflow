import { describe, expect, it } from "vitest";
import {
  CUSTOMER_SIDEBAR_EXTRA_ITEMS,
  customerNavItems,
} from "./customer-nav-items";
import { CUSTOMER_PREFIXES, startsWithAny } from "@/lib/supabase/middleware";

describe("the bottom bar", () => {
  it("stays at five slots for both experiences", () => {
    // The sixth turns every label into an unreadable sliver on a small phone,
    // which is why Membership and Referral went to the drawer instead.
    expect(customerNavItems("QUEUE")).toHaveLength(5);
    expect(customerNavItems("APPOINTMENT")).toHaveLength(5);
  });

  it("has the same five destinations whichever experience is on", () => {
    const queue = customerNavItems("QUEUE").map((item) => item.href);
    const appointment = customerNavItems("APPOINTMENT").map((item) => item.href);
    expect(queue).toEqual(appointment);
    expect(queue).toEqual(["/explore", "/my-serial", "/chats", "/transactions", "/profile"]);
  });

  it("**renames the bookings slot for a parlour customer**", () => {
    const queue = customerNavItems("QUEUE")[1];
    const appointment = customerNavItems("APPOINTMENT")[1];

    expect(queue.href).toBe("/my-serial");
    expect(appointment.href).toBe("/my-serial");
    expect(queue.label.bn).toBe("সিরিয়াল");
    expect(queue.label.en).toBe("Serial");
    expect(appointment.label.bn).toBe("অ্যাপয়েন্টমেন্ট");
    expect(appointment.label.en).toBe("Appointments");
  });

  it("gives it a different icon too, not just a different word", () => {
    expect(customerNavItems("QUEUE")[1].icon).not.toBe(
      customerNavItems("APPOINTMENT")[1].icon,
    );
  });

  it("labels every slot in both languages", () => {
    for (const model of ["QUEUE", "APPOINTMENT"] as const) {
      for (const item of customerNavItems(model)) {
        expect(item.label.bn, item.href).toBeTruthy();
        expect(item.label.en, item.href).toBeTruthy();
        expect(item.icon, item.href).toBeTruthy();
      }
    }
  });

  it("returns a fresh list, so a caller cannot mutate the nav for everyone", () => {
    expect(customerNavItems("QUEUE")).not.toBe(customerNavItems("QUEUE"));
    expect(customerNavItems("QUEUE")).toEqual(customerNavItems("QUEUE"));
  });
});

describe("the sidebar/drawer items (Sprint 11)", () => {
  const hrefs = CUSTOMER_SIDEBAR_EXTRA_ITEMS.map((item) => item.href);

  it("**Membership is a first-class customer destination**", () => {
    expect(hrefs).toContain("/membership");
  });

  it("**Referral is a first-class customer destination**", () => {
    expect(hrefs).toContain("/referral");
  });

  it("points at the customer's own routes, never the provider's plurals", () => {
    // `/memberships` and `/referrals` are the shop owner's management screens.
    // Linking a customer at those would bounce them home via middleware.
    expect(hrefs).not.toContain("/memberships");
    expect(hrefs).not.toContain("/referrals");
  });

  it("names them in both languages", () => {
    for (const item of CUSTOMER_SIDEBAR_EXTRA_ITEMS) {
      expect(item.label.bn, item.href).toBeTruthy();
      expect(item.label.en, item.href).toBeTruthy();
    }
  });

  it("does not duplicate anything already in the bottom bar", () => {
    const bottom = customerNavItems("QUEUE").map((item) => item.href);
    for (const href of hrefs) expect(bottom).not.toContain(href);
  });
});

describe("every customer destination is behind the auth gate", () => {
  it("**guards the two new routes**", () => {
    // A page under src/app with no matching prefix in the middleware is a page
    // anyone can open. Nothing else in the build notices that.
    expect(startsWithAny("/membership", CUSTOMER_PREFIXES)).toBe(true);
    expect(startsWithAny("/referral", CUSTOMER_PREFIXES)).toBe(true);
  });

  it("guards every href the customer navigation offers, except public explore", () => {
    const all = [
      ...customerNavItems("QUEUE"),
      ...customerNavItems("APPOINTMENT"),
      ...CUSTOMER_SIDEBAR_EXTRA_ITEMS,
    ].map((item) => item.href);

    for (const href of new Set(all)) {
      // `/explore` is deliberately public — browsing the catalogue needs no
      // account (Sprint 38).
      if (href === "/explore") continue;
      expect(startsWithAny(href, CUSTOMER_PREFIXES), href).toBe(true);
    }
  });

  it("does not accidentally guard the public explore route", () => {
    expect(startsWithAny("/explore", CUSTOMER_PREFIXES)).toBe(false);
    expect(startsWithAny("/explore/some-shop-id", CUSTOMER_PREFIXES)).toBe(false);
  });

  it("keeps the customer's singular routes clear of the provider's plurals", () => {
    expect(startsWithAny("/memberships", CUSTOMER_PREFIXES)).toBe(false);
    expect(startsWithAny("/referrals", CUSTOMER_PREFIXES)).toBe(false);
  });
});
