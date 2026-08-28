"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Flag,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  ScrollText,
  Scissors,
  Store,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/Wordmark";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { ADMIN_LEVEL_LABEL, ADMIN_LOGIN } from "@/config/constants";
import { useLogout } from "@/features/auth/hooks/use-logout";
import {
  useAdminOverview,
  useAdminTicketCounts,
  useMyAdminIdentity,
} from "@/features/admin/hooks/use-admin";
import { adminDict } from "@/features/admin/lib/i18n";
import { useT } from "@/lib/i18n";

const NAV = [
  { href: "/admin", label: "navOverview", icon: LayoutDashboard, exact: true },
  { href: "/admin/verification", label: "navVerification", icon: BadgeCheck, exact: false },
  { href: "/admin/shops", label: "navShops", icon: Store, exact: false },
  { href: "/admin/users", label: "navUsers", icon: Users, exact: false },
  { href: "/admin/moderation", label: "navModeration", icon: Flag, exact: false },
  { href: "/admin/support", label: "navSupport", icon: LifeBuoy, exact: false },
  { href: "/admin/team", label: "navTeam", icon: UsersRound, exact: false },
  { href: "/admin/styles", label: "navStyles", icon: Scissors, exact: false },
  { href: "/admin/audit", label: "navAudit", icon: ScrollText, exact: false },
] as const;

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: identity } = useMyAdminIdentity();
  const { data: overview } = useAdminOverview();
  const { data: ticketCounts } = useAdminTicketCounts();
  const logout = useLogout(ADMIN_LOGIN);
  const t = useT(adminDict);
  const levelT = useT(ADMIN_LEVEL_LABEL);

  return (
    <aside
      className="flex h-full w-59 shrink-0 flex-col overflow-y-auto border-l border-line bg-card px-4 py-5.5 text-ink md:border-l-0 md:border-r"
      style={{ paddingBottom: "max(1.375rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mb-3.5 flex items-center justify-between px-2">
        <LanguageToggle />
      </div>

      {/* The brand leads and the panel name qualifies it underneath. The old
          header showed only "এডমিন প্যানেল", so the product name — the thing
          the whole system is called — never appeared in the panel at all. */}
      <Link href="/admin" onClick={onNavigate} className="block px-2 pb-5">
        <Wordmark size="md" sub={t("panelName")} />
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
                : item.href === "/admin/support"
                  ? (ticketCounts?.pending ?? 0)
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
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 font-number text-[11px] font-bold",
                    active ? "bg-accent-ink/20 text-accent-ink" : "bg-live text-white",
                  )}
                >
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* An admin has no profiles row since Sprint 36 — no avatar to show and
          no /account page that would work — so the identity block reads name,
          email and role straight from admin_users. */}
      <div className="mt-auto space-y-1 border-t border-line pt-3.5">
        <div className="min-w-0 px-2">
          <p className="truncate text-[13px] font-bold text-ink">{identity?.full_name ?? "—"}</p>
          <p className="truncate text-[11px] text-muted">{identity?.email ?? ""}</p>
          {identity && (
            <span className="mt-1.5 inline-flex rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
              {levelT(identity.level)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-xs text-muted transition-colors hover:bg-soft hover:text-ink disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}
