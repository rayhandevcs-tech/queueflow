"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { useDueCount } from "@/features/provider-due-ledger/hooks/use-due-ledger";
import { useLanguage, useT } from "@/lib/i18n";
import { useTerms } from "@/lib/business-terms";
import { bookingModel } from "@/lib/business-model";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import {
  matchesRoute,
  providerNavSections,
  sectionForPath,
  type ProviderNavLabel,
} from "./provider-nav-items";

/**
 * The screens inside one sidebar section, as a row of tabs.
 *
 * ---------------------------------------------------------------------------
 * Why links and not a tab widget
 * ---------------------------------------------------------------------------
 * `TabBar` in `components/ui` switches state inside one page. This does not:
 * every tab here is a real route that already existed and still has its own
 * URL, its own queries and its own place in the middleware's protected list.
 * So these are `<Link>`s, which means the back button works, a tab can be
 * opened in a new window, and `/rewards` stays a link somebody can paste.
 *
 * The alternative — merging six pages into three with a `?tab=` parameter —
 * would have meant rewriting six working screens and breaking every inbound
 * link to them, to produce the same thing the owner sees here.
 *
 * ---------------------------------------------------------------------------
 * Lives in the shell, not on the pages
 * ---------------------------------------------------------------------------
 * Rendered once in `ProviderShell` and derived from the pathname, so a page
 * gains its tabs by being listed in `provider-nav-items` and nowhere else.
 * Putting a strip on each of the eleven grouped pages would have been eleven
 * chances for one of them to be forgotten, and the forgotten one is the page
 * that looks broken.
 *
 * Absent entirely for a section with one screen, and for a route outside the
 * sidebar (`/account`, `/help`) — a single tab is not a choice, and drawing
 * one would just be a heading in disguise.
 */
export function ProviderSectionTabs() {
  const pathname = usePathname();
  const { data: shop } = useMyShop();
  const { language } = useLanguage();
  const t = useT(providerCatalogDict);
  const tt = useTerms(shop?.business_type, language);
  const dueCount = useDueCount(shop?.id);

  const sections = providerNavSections(bookingModel(shop?.business_type));
  const section = sectionForPath(sections, pathname);

  if (!section || section.tabs.length < 2) return null;

  const labelOf = (label: ProviderNavLabel): string => {
    if (label.kind === "term") return tt(label.key);
    if (label.kind === "dictWithChair") return t(label.key, tt("chair"));
    return t(label.key);
  };

  return (
    <nav
      // `mb-5` rather than a gap: the pages below own their own top spacing,
      // and several open with a PageHeader that already has breathing room.
      className={cn(
        "mb-5 flex gap-1.5 overflow-x-auto border-b border-line pb-px",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
      aria-label={labelOf(section.label)}
    >
      {section.tabs.map((tab) => {
        const active = matchesRoute(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5",
              "text-sm font-semibold whitespace-nowrap transition-colors",
              active
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {labelOf(tab.label)}
            {/* The due count, on the tab that leads to it. The sidebar row
                carries the same number for the whole section; here it says
                which of the two screens the number is about. */}
            {tab.href === "/due-ledger" && dueCount > 0 && (
              <span className="rounded-full bg-live px-1.75 py-0.25 font-number text-[11px] font-bold text-white">
                {dueCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
