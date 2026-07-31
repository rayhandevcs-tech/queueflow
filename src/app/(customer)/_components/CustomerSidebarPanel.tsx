"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Languages, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useMyActiveSerial } from "@/features/customer-booking/hooks/use-my-serial";
import { useMyUnreadChatCount } from "@/features/chat/hooks/use-chat-threads";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { LANGUAGES, useLanguage, useT } from "@/lib/i18n";
import { CUSTOMER_NAV_ITEMS, CUSTOMER_SIDEBAR_ITEMS } from "./customer-nav-items";
import { customerShellDict } from "./i18n";

/**
 * Shared content for both the mobile drawer (opened via hamburger) and the
 * persistent desktop sidebar — the full নেভ (হোম/সিরিয়াল/চ্যাট/প্রোফাইল +
 * লেনদেন-হিস্টরি + ভাষা/অ্যাকাউন্ট/লগ-আউট) always renders here, on every viewport.
 */
export function CustomerSidebarPanel({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: profile } = useMyProfile();
  const { data: activeSerial } = useMyActiveSerial();
  const unreadChatCount = useMyUnreadChatCount();
  const logout = useLogout();
  const { language, setLanguage } = useLanguage();
  const t = useT(customerShellDict);

  const name = profile?.full_name || t("customerFallback");

  const navItem = (item: (typeof CUSTOMER_NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-sm transition-colors",
          active ? "bg-accent font-bold text-accent-ink" : "font-medium text-muted hover:bg-soft hover:text-ink",
        )}
      >
        <span className="relative grid h-4.5 w-4.5 shrink-0 place-items-center">
          <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.3 : 1.9} />
          {item.href === "/my-serial" && activeSerial && (
            <span
              className={cn(
                "absolute -right-1 -top-1 h-1.75 w-1.75 rounded-full bg-live",
                active && "bg-accent-ink",
              )}
            />
          )}
          {item.href === "/chats" && unreadChatCount > 0 && (
            <span
              className={cn(
                "absolute -right-1 -top-1 h-1.75 w-1.75 rounded-full bg-accent",
                active && "bg-accent-ink",
              )}
            />
          )}
        </span>
        {item.label[language]}
      </Link>
    );
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l border-line bg-card px-4 py-5.5 text-ink lg:w-59 lg:border-l-0 lg:border-r">
      <div className="mb-4.5 flex items-center gap-1.5 rounded-[20px] border border-line bg-soft/60 p-2">
        <Link
          href="/profile"
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2.75 rounded-[15px] p-1 transition-colors hover:bg-card"
        >
          <div className="relative shrink-0">
            <div className="grid h-11.5 w-11.5 place-items-center overflow-hidden rounded-[15px] bg-accent font-display text-xl font-extrabold text-accent-ink shadow-xs ring-2 ring-card">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
              ) : (
                name.trim().charAt(0).toUpperCase() || "?"
              )}
            </div>
            {activeSerial && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-card bg-live"
              >
                <span className="h-1 w-1 animate-pulse-live rounded-full bg-white" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-bold leading-tight">{name}</p>
            <p className="truncate text-[11px] leading-tight text-muted">{profile?.phone || "—"}</p>
            <span className="mt-1 flex items-center gap-0.5 text-[10px] font-semibold text-accent">
              {t("viewProfile")}
              <ChevronRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </Link>
        <NotificationBell className="text-muted hover:bg-card hover:text-ink" />
      </div>

      <nav className="flex flex-col gap-0.75">
        {CUSTOMER_NAV_ITEMS.map(navItem)}
        <span aria-hidden className="my-1.5 h-px bg-line" />
        {CUSTOMER_SIDEBAR_ITEMS.map(navItem)}
      </nav>

      <div className="mt-auto flex flex-col gap-0.75 border-t border-line pt-3 lg:mt-3">
        <div className="flex items-center gap-2.75 rounded-xl px-3.25 py-2">
          <Languages className="h-4.5 w-4.5 shrink-0 text-muted" />
          <span className="text-sm font-medium text-muted">{t("languageLabel")}</span>
          <div className="ml-auto flex shrink-0 rounded-[10px] bg-soft p-0.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
                className={cn(
                  "rounded-lg px-2 py-1 text-[11px] font-bold transition-colors",
                  language === lang
                    ? "bg-card text-ink shadow-xs"
                    : "text-muted hover:text-ink",
                )}
              >
                {lang === "bn" ? "বাংলা" : "EN"}
              </button>
            ))}
          </div>
        </div>

        <Link
          href="/account"
          onClick={onNavigate}
          className="flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-sm font-medium text-muted transition-colors hover:bg-soft hover:text-ink"
        >
          <Settings className="h-4.5 w-4.5 shrink-0" />
          {t("accountSettings")}
        </Link>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-left text-sm font-medium text-muted transition-colors hover:bg-soft hover:text-ink disabled:opacity-50"
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {logout.isPending ? "…" : t("logout")}
        </button>
      </div>
    </aside>
  );
}
