"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Armchair,
  BarChart3,
  LifeBuoy,
  LogOut,
  Megaphone,
  MessageCircle,
  NotebookPen,
  Percent,
  Radio,
  Receipt,
  Scissors,
  Settings as SettingsIcon,
  Star,
  Users,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyShop, useShopMutations } from "@/features/provider-catalog/hooks/use-my-shop";
import { useLiveQueueCount } from "@/features/provider-queue/hooks/use-sidebar-stats";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useShopUnreadChatCount } from "@/features/chat/hooks/use-chat-threads";
import { useDueCount } from "@/features/provider-due-ledger/hooks/use-due-ledger";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { useToast } from "@/components/ui/Toast";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Wordmark } from "@/components/ui/Wordmark";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { StatusPill } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Switch";
import { useT, useLanguage } from "@/lib/i18n";
import { useTerms } from "@/lib/business-terms";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { supportDict } from "@/features/support/lib/i18n";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Radio;
  live?: boolean;
  soon?: boolean;
}

export function ProviderSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const showToast = useToast();
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

  const NAV: NavItem[] = [
    { href: "/dashboard", label: t("navLiveQueue"), icon: Radio, live: true },
    // Salon says "চেয়ার", parlour says "সিট" — decided once, at registration.
    { href: "/chairs", label: tt("chair"), icon: Armchair },
    { href: "/services", label: t("navServices"), icon: Scissors },
    { href: "/offers", label: t("navOffers"), icon: Percent },
    { href: "/chat", label: t("navChat"), icon: MessageCircle },
    { href: "/income", label: t("navIncome"), icon: Wallet },
    { href: "/cashbook", label: t("navTransactions"), icon: ArrowLeftRight },
    { href: "/manual-entries", label: t("navManualEntries"), icon: NotebookPen },
    { href: "/due-ledger", label: t("navDueLedger"), icon: Receipt },
    { href: "/analytics", label: t("navAnalytics"), icon: BarChart3 },
    { href: "/regulars", label: t("navRegulars"), icon: Users },
    { href: "/notifications/send", label: t("navSendNotification"), icon: Megaphone },
    { href: "/reviews", label: t("navReviews"), icon: Star },
    { href: "/settings", label: t("navSettings"), icon: SettingsIcon },
  ];

  return (
    <aside
      className="flex h-full w-59 shrink-0 flex-col overflow-y-auto border-l border-line bg-card px-4 py-5.5 text-ink md:border-l-0 md:border-r"
      style={{ paddingBottom: "max(1.375rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mb-3.5 flex items-center justify-between px-2">
        <LanguageToggle />
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
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");

          if (item.soon) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  showToast(t("comingSoon", item.label));
                  onNavigate?.();
                }}
                className="flex items-center gap-2.75 rounded-xl px-3.25 py-3 text-left text-sm font-medium text-muted/50"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.75 rounded-xl px-3.25 py-3 text-sm transition-colors",
                active
                  ? "bg-accent font-bold text-accent-ink"
                  : "font-medium text-muted hover:bg-soft",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {item.live && liveCount > 0 && (
                <span className="ml-auto rounded-full bg-live px-2 py-0.5 font-number text-[11px] font-bold text-white">
                  {liveCount}
                </span>
              )}
              {item.href === "/chat" && unreadChatCount > 0 && (
                <span className="ml-auto rounded-full bg-accent px-2 py-0.5 font-number text-[11px] font-bold text-accent-ink">
                  {unreadChatCount}
                </span>
              )}
              {item.href === "/due-ledger" && dueCount > 0 && (
                <span className="ml-auto rounded-full bg-live px-2 py-0.5 font-number text-[11px] font-bold text-white">
                  {dueCount}
                </span>
              )}
            </Link>
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
