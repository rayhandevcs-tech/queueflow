"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, LogOut, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/Wordmark";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useMyActiveSerial } from "@/features/customer-booking/hooks/use-my-serial";
import { useMyUnreadChatCount } from "@/features/chat/hooks/use-chat-threads";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useLanguage, useT } from "@/lib/i18n";
import { supportDict } from "@/features/support/lib/i18n";
import { CUSTOMER_NAV_ITEMS } from "./customer-nav-items";
import { customerShellDict } from "./i18n";

/**
 * Shared content for both the mobile drawer (opened via hamburger) and the
 * persistent desktop sidebar — the full নেভ (হোম/সিরিয়াল/প্রোফাইল +
 * অ্যাকাউন্ট/লগ-আউট) always renders here, on every viewport.
 */
export function CustomerSidebarPanel({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: profile } = useMyProfile();
  const { data: activeSerial } = useMyActiveSerial();
  const unreadChatCount = useMyUnreadChatCount();
  const logout = useLogout();
  const { language } = useLanguage();
  const t = useT(customerShellDict);
  const supportT = useT(supportDict);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l border-line bg-card px-4 py-5.5 text-ink lg:w-59 lg:border-l-0 lg:border-r">
      {/* The desktop sidebar led with the user's own avatar, so the product
          name never appeared on screen once you were signed in. */}
      <div className="px-2 pb-4">
        <Link href="/explore" onClick={onNavigate} className="block">
          <Wordmark size="md" />
        </Link>

        {/* Under the brand rather than beside it: at this width the wordmark
            already fills the row, and a control alongside it squeezed the name
            it was meant to accompany. */}
        <LanguageToggle className="mt-2.5" />
      </div>

      <div className="flex items-center gap-2.75 border-t border-line px-2 pt-4 pb-5.5">
        <Link href="/profile" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.75">
          <div className="grid h-10.5 w-10.5 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-accent font-display text-xl font-extrabold text-accent-ink">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile?.full_name ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              profile?.full_name?.trim().charAt(0).toUpperCase() || "?"
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-bold">
              {profile?.full_name || t("customerFallback")}
            </p>
            <p className="truncate text-[11px] text-muted">{profile?.phone || "—"}</p>
          </div>
        </Link>
        <NotificationBell className="text-muted hover:bg-soft" />
      </div>

      <nav className="flex flex-col gap-0.75">
        {CUSTOMER_NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-sm transition-colors",
                active
                  ? "bg-accent font-bold text-accent-ink"
                  : "font-medium text-muted hover:bg-soft",
              )}
            >
              <span className="relative leading-none">
                <item.icon
                  className="h-4.5 w-4.5"
                  // Not filled when active: `fill` floods the whole glyph, so
                  // a house became a solid blob and a speech bubble a solid
                  // rectangle. Weight and colour already say "you are here".
                  strokeWidth={active ? 2.5 : 1.75}
                />
                {item.href === "/my-serial" && activeSerial && (
                  <span className="absolute -right-1 -top-1 h-1.75 w-1.75 rounded-full bg-live" />
                )}
                {item.href === "/chats" && unreadChatCount > 0 && (
                  <span className="absolute -right-1 -top-1 h-1.75 w-1.75 rounded-full bg-accent" />
                )}
              </span>
              {item.label[language]}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.75 border-t border-line pt-3 lg:mt-3">
        <Link
          href="/help"
          onClick={onNavigate}
          className="flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-sm font-medium text-muted hover:bg-soft"
        >
          <LifeBuoy className="h-4 w-4" />
          {supportT("supportTitle")}
        </Link>
        <Link
          href="/account"
          onClick={onNavigate}
          className="flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-sm font-medium text-muted hover:bg-soft"
        >
          <UserRound className="h-4 w-4" />
          {t("accountSettings")}
        </Link>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-left text-sm font-medium text-muted hover:bg-soft disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {logout.isPending ? "…" : t("logout")}
        </button>
      </div>
    </aside>
  );
}
