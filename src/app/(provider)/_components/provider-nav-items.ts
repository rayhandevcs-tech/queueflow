import {
  Armchair,
  ArrowLeftRight,
  Award,
  BarChart3,
  CalendarClock,
  CalendarDays,
  Crown,
  MessageCircle,
  NotebookPen,
  Radio,
  Settings as SettingsIcon,
  Sparkles,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { BookingModel } from "@/lib/business-model";
import type { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";

/**
 * A label key that really is in the dictionary.
 *
 * Type-only import, so this module stays free of anything that runs — but a
 * mistyped key is now a compile error rather than a `Cannot read properties of
 * undefined` the first time somebody opens that section.
 */
type NavDictKey = keyof typeof providerCatalogDict;

/**
 * The provider sidebar, as data.
 *
 * ---------------------------------------------------------------------------
 * Why this is a module and not an array inside the component
 * ---------------------------------------------------------------------------
 * The sidebar had twenty-one flat entries, which is more than a menu can be —
 * past about a dozen, a list stops being something you read and becomes
 * something you scan twice and give up on. Six of those entries were pairs or
 * triples of the same subject reached from different angles: chairs and the
 * service list are both "what this shop sells and who does it", loyalty and
 * referral and rewards are one points balance spent three ways, income and the
 * due ledger are the same money in two states.
 *
 * So the sidebar now names SUBJECTS, and each subject with more than one
 * screen carries its screens as tabs. That needs the grouping to exist in one
 * place that both the sidebar and the tab strip read — otherwise "which
 * screens sit under Loyalty" would be written twice and would drift.
 *
 * ---------------------------------------------------------------------------
 * Nothing was removed, and no route changed
 * ---------------------------------------------------------------------------
 * Every one of the twenty-one routes still exists at the same path. A
 * bookmark, a link from the queue board to `/chairs`, the middleware's
 * protected-route list and the AI copilot's "you do that yourself at
 * /rewards" all keep working, because reorganising a menu should not
 * invalidate anything outside the menu. What changed is how many lines the
 * owner reads to find one of them.
 *
 * ---------------------------------------------------------------------------
 * Labels
 * ---------------------------------------------------------------------------
 * Two vocabularies meet here. Most labels are ordinary dictionary keys; a few
 * are business-type terms (`board` is "লাইভ সিরিয়াল" for a salon and "আজকের
 * সময়সূচি" for a parlour, `chair` is চেয়ার against সিট). Rather than resolve
 * either here — this module is pure, with no hooks and no language — a label
 * says which vocabulary it belongs to and the sidebar resolves it. That is
 * also what keeps this file testable without a React tree.
 */

/** Which dictionary a label comes from. */
export type ProviderNavLabel =
  /** A key in `providerCatalogDict`. */
  | { kind: "dict"; key: NavDictKey }
  /** A key in `business-terms`, resolved against the shop's own type. */
  | { kind: "term"; key: "board" | "chair" | "chairs" }
  /** A dict key that takes the shop's word for a chair as its one argument. */
  | { kind: "dictWithChair"; key: NavDictKey };

/** A screen inside a section. Only sections with two or more have any. */
export interface ProviderNavTab {
  href: string;
  label: ProviderNavLabel;
}

/**
 * The count that rides on a sidebar row.
 *
 * Named rather than passed as a number so this module needs no queries. The
 * sidebar owns the hooks and decides what each name means.
 *
 * `due` is the one that moved: the "three people owe you money" badge used to
 * sit on the `/due-ledger` row, and that row is now a tab. Left alone, the
 * signal would have disappeared from the sidebar entirely — a badge whose
 * whole job is to be seen without navigating.
 */
export type ProviderNavBadge = "queue" | "chat" | "due";

export interface ProviderNavSection {
  /** Stable id, for tests and for `key`. Never shown. */
  id: string;
  /** Where the sidebar row goes: the first tab, or the section's own route. */
  href: string;
  label: ProviderNavLabel;
  icon: LucideIcon;
  badge?: ProviderNavBadge;
  /**
   * The screens under this subject, in the order the owner reads them.
   * Empty for a section that is a single screen.
   */
  tabs: ReadonlyArray<ProviderNavTab>;
}

const dict = (key: NavDictKey): ProviderNavLabel => ({ kind: "dict", key });

/**
 * The sidebar for one shop.
 *
 * Takes a booking model rather than a `business_type`, for the same reason
 * every other screen does: `/appointments` exists for a parlour and not for a
 * salon, and that is a fact about how the shop takes work in.
 */
export function providerNavSections(
  model: BookingModel,
): ReadonlyArray<ProviderNavSection> {
  const appointment = model === "APPOINTMENT";

  return [
    {
      id: "board",
      href: "/dashboard",
      label: { kind: "term", key: "board" },
      icon: appointment ? CalendarClock : Radio,
      // A parlour's home screen is its day's schedule, not a live line, so it
      // neither names one nor counts one: the badge would sit at 0 forever.
      badge: appointment ? undefined : "queue",
      tabs: [],
    },

    // The register of every booking, past and coming. Parlour only — a salon
    // has no appointments to list, and the page itself says so to anyone who
    // arrives from a bookmark.
    ...(appointment
      ? [
          {
            id: "appointments",
            href: "/appointments",
            label: dict("navAppointments"),
            icon: CalendarDays,
            tabs: [],
          } as const,
        ]
      : []),

    // What the shop sells, and who does it. Two screens that were always read
    // together: a service with no one able to perform it is not on sale, and
    // the can-perform matrix on `/services` is literally a grid of the chairs
    // configured on `/chairs`.
    {
      id: "catalogue",
      href: "/chairs",
      label: { kind: "dictWithChair", key: "navCatalogueGroup" },
      icon: Armchair,
      tabs: [
        { href: "/chairs", label: { kind: "term", key: "chairs" } },
        { href: "/services", label: dict("navServices") },
      ],
    },

    // Membership and offers: the two ways a shop discounts on purpose. An
    // offer is a price cut for anybody, a membership is one for a subscriber —
    // and an owner setting up either is answering the same question.
    {
      id: "membership",
      href: "/memberships",
      label: dict("navMembershipGroup"),
      icon: Crown,
      tabs: [
        { href: "/memberships", label: dict("navMemberships") },
        { href: "/offers", label: dict("navOffers") },
      ],
    },

    // One points balance, spent three ways. Referral PAYS in loyalty points
    // and rewards SPEND them — neither has a balance of its own, which is why
    // `/referrals` and `/rewards` both read the loyalty settings to render at
    // all. Three sidebar lines for one programme was the clearest case here.
    {
      id: "loyalty",
      href: "/loyalty",
      label: dict("navLoyaltyGroup"),
      icon: Award,
      tabs: [
        { href: "/loyalty", label: dict("navLoyalty") },
        { href: "/referrals", label: dict("navReferrals") },
        { href: "/rewards", label: dict("navRewards") },
      ],
    },

    {
      id: "chat",
      href: "/chat",
      label: dict("navChat"),
      icon: MessageCircle,
      badge: "chat",
      tabs: [],
    },

    // Money earned, in its two states: collected, and owed. The due ledger was
    // never a separate subject — `income` already reports a cash/due split on
    // every card, so the ledger is the "due" half of a number the owner is
    // already reading.
    {
      id: "money",
      href: "/income",
      label: dict("navMoneyGroup"),
      icon: Wallet,
      badge: "due",
      tabs: [
        { href: "/income", label: dict("navIncome") },
        { href: "/due-ledger", label: dict("navDueLedger") },
      ],
    },

    {
      id: "cashbook",
      href: "/cashbook",
      label: dict("navTransactions"),
      icon: ArrowLeftRight,
      tabs: [],
    },
    {
      id: "manual-entries",
      href: "/manual-entries",
      label: dict("navManualEntries"),
      icon: NotebookPen,
      tabs: [],
    },
    { id: "ai", href: "/ai", label: dict("navAi"), icon: Sparkles, tabs: [] },
    {
      id: "analytics",
      href: "/analytics",
      label: dict("navAnalytics"),
      icon: BarChart3,
      tabs: [],
    },

    // Talking to the people who already came. A review is what they said
    // unprompted, a broadcast is what the shop says to them, and the regulars
    // list is who is worth saying it to — the same relationship from three
    // sides, and the broadcast screen is the one the AI campaign card shares a
    // daily budget with.
    {
      id: "customers",
      href: "/reviews",
      label: dict("navCustomersGroup"),
      icon: Star,
      tabs: [
        { href: "/reviews", label: dict("navReviews") },
        { href: "/notifications/send", label: dict("navSendNotification") },
        { href: "/regulars", label: dict("navRegulars") },
      ],
    },

    {
      id: "settings",
      href: "/settings",
      label: dict("navSettings"),
      icon: SettingsIcon,
      tabs: [],
    },
  ];
}

/**
 * Does this path belong to this href?
 *
 * Prefix-matched on a segment boundary, so `/chairs` covers `/chairs/5` while
 * `/notifications/send` does NOT get claimed by a hypothetical
 * `/notifications-archive`. The old sidebar used a bare `startsWith`, which
 * was fine while every route was one segment and is not fine now that
 * `/notifications/send` is in the list.
 */
export function matchesRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * The section a path sits in, or null for a route outside the sidebar
 * (`/account`, `/help`, `/payment-methods`).
 *
 * Longest href first, because `/notifications/send` and a future
 * `/notifications` would otherwise be decided by array order rather than by
 * specificity.
 */
export function sectionForPath(
  sections: ReadonlyArray<ProviderNavSection>,
  pathname: string,
): ProviderNavSection | null {
  let best: ProviderNavSection | null = null;
  let bestLength = -1;

  for (const section of sections) {
    const hrefs = section.tabs.length > 0 ? section.tabs.map((tab) => tab.href) : [section.href];
    for (const href of hrefs) {
      if (matchesRoute(pathname, href) && href.length > bestLength) {
        best = section;
        bestLength = href.length;
      }
    }
  }

  return best;
}
