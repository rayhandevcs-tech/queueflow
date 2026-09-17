"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyShop, useShopMutations } from "@/features/provider-catalog/hooks/use-my-shop";
import { useLiveQueueCount } from "@/features/provider-queue/hooks/use-sidebar-stats";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useShopUnreadChatCount } from "@/features/chat/hooks/use-chat-threads";
import { useDueCount } from "@/features/provider-due-ledger/hooks/use-due-ledger";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Wordmark } from "@/components/ui/Wordmark";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { StatusPill } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Switch";
import { useT, useLanguage } from "@/lib/i18n";
import { useTerms } from "@/lib/business-terms";
import { bookingModel } from "@/lib/business-model";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { supportDict } from "@/features/support/lib/i18n";
import {
  matchesRoute,
  providerNavSections,
  sectionForPath,
  type ProviderNavBadge,
  type ProviderNavLabel,
} from "./provider-nav-items";

export function ProviderSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: shop } = useMyShop();
  const { data: profile } = useMyProfile();
  const { update } = useShopMutations();
  const liveCount = useLiveQueueCount(shop?.id);
  const unreadChatCount = useShopUnreadChatCount(shop?.id);
  const dueCount = useDueCount(shop?.id);
  const logout = useLogout();
  const { language } = useLanguage();
  const t = useT(providerCatalogDict);
  const tt = useTerms(shop?.business_type, language);
  const supportT = useT(supportDict);

  /**
   * Twenty-one rows became thirteen — see `provider-nav-items.ts` for which
   * screens were grouped and why. Every route still exists; what changed is
   * that six of them are now reached through a tab strip rather than a
   * sidebar line of their own.
   */
  const sections = providerNavSections(bookingModel(shop?.business_type));
  const activeSection = sectionForPath(sections, pathname);

  /**
   * Resolve a label against whichever vocabulary it declares.
   *
   * Kept here rather than in the nav module because two of the three
   * vocabularies are hooks: `useT` re-renders on a language change and
   * `useTerms` needs the shop row. The module stays pure and testable.
   */
  const labelOf = (label: ProviderNavLabel): string => {
    if (label.kind === "term") return tt(label.key);
    if (label.kind === "dictWithChair") return t(label.key, tt("chair"));
    return t(label.key);
  };

  /** A badge's number, or 0 for "nothing to show". */
  const badgeCount = (badge: ProviderNavBadge | undefined): number => {
    if (badge === "queue") return liveCount;
    if (badge === "chat") return unreadChatCount;
    if (badge === "due") return dueCount;
    return 0;
  };

  return (
    <aside
      className="flex h-full w-59 shrink-0 flex-col overflow-y-auto border-l border-line bg-card px-4 py-5.5 text-ink md:border-l-0 md:border-r"
      style={{ paddingBottom: "max(1.375rem, env(safe-area-inset-bottom))" }}
    >
      {/* The two "how this app looks and reads to me" controls, together:
          language and theme. Both are device-local preferences, so they sit
          in the chrome rather than behind Settings. */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 px-2">
        <LanguageToggle />
        <ThemeToggle compact />
      </div>

      {/* Brand above the shop identity: the sidebar used to open with the
          shop's own logo, which told the owner nothing about which product
          they were in. */}
      <Link href="/dashboard" onClick={onNavigate} className="block px-2 pb-4">
        <Wordmark size="md" />
      </Link>

      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2.75 border-t border-line px-2 pt-4 pb-3"
      >
        <AvatarChip label={shop?.name} avatarUrl={shop?.logo_url} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold">{shop?.name ?? "…"}</p>
          {shop?.address && <p className="truncate text-[11px] text-muted">{shop.address}</p>}
        </div>
      </Link>

      <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-soft px-3 py-2">
        <StatusPill
          tone={shop?.is_open ? "good" : "neutral"}
          pulse={shop?.is_open}
          label={shop?.is_open ? t("shopOpenWord") : t("shopClosedWord")}
        />
        <Switch
          checked={!!shop?.is_open}
          // A shop that isn't verified/active can't take serials at all, so the
          // open/closed switch stays locked until an admin clears its status.
          // (`?? "ACTIVE"` — a deploy landing before the migration stays usable.)
          disabled={!shop || (shop.status ?? "ACTIVE") !== "ACTIVE" || update.isPending}
          onChange={(next) => {
            if (shop) update.mutate({ shopId: shop.id, patch: { is_open: next } });
          }}
        />
      </div>

      {/* Closing time, not closing the shop: keep serving the queue, stop the
          intake. Only meaningful while the shop is actually open. */}
      {shop?.is_open && (
        <div className="mb-5.5 rounded-xl bg-soft px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-xs font-semibold",
                (shop.accepting_new ?? true) ? "text-ink" : "text-live",
              )}
            >
              {(shop.accepting_new ?? true)
                ? t("acceptingNewLabel")
                : t("notAcceptingLabel")}
            </span>
            <Switch
              checked={shop.accepting_new ?? true}
              disabled={update.isPending}
              onChange={(next) => update.mutate({ shopId: shop.id, patch: { accepting_new: next } })}
            />
          </div>
          {(shop.accepting_new ?? true) === false && (
            <p className="mt-1.5 text-[11px] leading-snug text-muted">
              {t("acceptingNewHint")}
            </p>
          )}
        </div>
      )}

      <nav className="flex flex-col gap-0.75">
        {sections.map((section) => {
          const Icon = section.icon;
          // A section is active when ANY of its screens is — otherwise
          // `/offers` would highlight nothing, since its own row is gone.
          const active = activeSection?.id === section.id;
          const count = badgeCount(section.badge);

          return (
            <div key={section.id}>
              <Link
                href={section.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.75 rounded-xl px-3.25 py-3 text-sm transition-colors",
                  active
                    ? "bg-accent font-bold text-accent-ink"
                    : "font-medium text-muted hover:bg-soft",
                )}
              >
                <Icon className="h-4 w-4" />
                {labelOf(section.label)}
                {count > 0 && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 font-number text-[11px] font-bold",
                      // Chat is the one that is merely unread; a queue and an
                      // unpaid bill are both things going wrong right now.
                      section.badge === "chat"
                        ? "bg-accent text-accent-ink"
                        : "bg-live text-white",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>

              {/* The section's screens, listed under it only while the owner
                  is inside it. Always-expanded would put the twenty-one rows
                  straight back; collapsed-with-a-chevron would hide the tabs
                  behind a second tap for no gain, because the page itself
                  already shows them. */}
              {active && section.tabs.length > 1 && (
                <div className="mt-0.5 mb-1 flex flex-col gap-0.25 border-l border-line pl-3.25 ml-4.5">
                  {section.tabs.map((tab) => (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      onClick={onNavigate}
                      className={cn(
                        "rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                        matchesRoute(pathname, tab.href)
                          ? "font-bold text-accent"
                          : "font-medium text-muted hover:bg-soft hover:text-ink",
                      )}
                    >
                      {labelOf(tab.label)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <Link
        href="/help"
        onClick={onNavigate}
        className="mt-auto flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-sm font-medium text-muted transition-colors hover:bg-soft hover:text-ink"
      >
        <LifeBuoy className="h-4.5 w-4.5" />
        {supportT("supportTitle")}
      </Link>

      <div className="flex items-center gap-1 px-1">
        <Link
          href="/account"
          onClick={onNavigate}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1.5 pl-1 pr-2 text-xs text-muted hover:bg-soft hover:text-ink"
        >
          <AvatarChip label={profile?.full_name} avatarUrl={profile?.avatar_url} shape="circle" size={26} />
          <span className="truncate">{t("accountLink")}</span>
        </Link>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-soft hover:text-ink disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {logout.isPending ? "…" : t("signOut")}
        </button>
      </div>
    </aside>
  );
}
