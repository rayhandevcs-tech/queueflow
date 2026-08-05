"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, Flag, LayoutDashboard, LogOut, ShieldCheck, Store, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useAdminOverview } from "@/features/admin/hooks/use-admin";
import { adminDict } from "@/features/admin/lib/i18n";
import { useT, useLanguage } from "@/lib/i18n";

const NAV = [
  { href: "/admin", label: "navOverview", icon: LayoutDashboard, exact: true },
  { href: "/admin/verification", label: "navVerification", icon: BadgeCheck, exact: false },
  { href: "/admin/shops", label: "navShops", icon: Store, exact: false },
  { href: "/admin/users", label: "navUsers", icon: Users, exact: false },
  { href: "/admin/moderation", label: "navModeration", icon: Flag, exact: false },
] as const;

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: profile } = useMyProfile();
  const { data: overview } = useAdminOverview();
  const logout = useLogout();
  const { language, setLanguage } = useLanguage();
  const t = useT(adminDict);

  return (
    <aside
      className="flex h-full w-59 shrink-0 flex-col overflow-y-auto border-l border-line bg-card px-4 py-5.5 text-ink md:border-l-0 md:border-r"
      style={{ paddingBottom: "max(1.375rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mb-3.5 flex items-center justify-between px-2">
        <div
          role="group"
          aria-label={t("quickLanguageAria")}
          className="inline-flex rounded-full bg-soft p-0.5 text-[11px] font-semibold"
        >
          <button
            type="button"
            onClick={() => setLanguage("bn")}
            className={cn(
              "min-h-9 min-w-9 rounded-full px-2 transition-colors",
              language === "bn" ? "bg-accent text-accent-ink" : "text-muted",
            )}
          >
            {t("languageBnShort")}
          </button>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={cn(
              "min-h-9 min-w-9 rounded-full px-2 transition-colors",
              language === "en" ? "bg-accent text-accent-ink" : "text-muted",
            )}
          >
            {t("languageEnShort")}
          </button>
        </div>
      </div>

      <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2.75 px-2 pb-5">
        <span className="grid h-10.5 w-10.5 shrink-0 place-items-center rounded-2xl bg-accent text-accent-ink">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <p className="truncate font-display text-[15px] font-bold">{t("panelName")}</p>
      </Link>

      <nav className="flex flex-col gap-0.75">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const badgeCount =
            item.href === "/admin/verification"
              ? (overview?.shops_pending ?? 0)
              : item.href === "/admin/moderation"
                ? (overview?.open_reports ?? 0)
                : 0;

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
              {t(item.label)}
              {badgeCount > 0 && (
                <span className="ml-auto rounded-full bg-live px-2 py-0.5 font-number text-[11px] font-bold text-white">
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-1 px-1">
        <Link
          href="/account"
          onClick={onNavigate}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1.5 pl-1 pr-2 text-xs text-muted hover:bg-soft hover:text-ink"
        >
          <AvatarChip
            label={profile?.full_name}
            avatarUrl={profile?.avatar_url}
            shape="circle"
            size={26}
          />
          <span className="truncate">{t("accountLink")}</span>
        </Link>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-soft hover:text-ink disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}
