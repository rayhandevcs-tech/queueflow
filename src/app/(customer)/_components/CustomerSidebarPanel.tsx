"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useMyActiveSerial } from "@/features/customer-booking/hooks/use-my-serial";
import { CUSTOMER_NAV_ITEMS } from "./customer-nav-items";

/**
 * Shared content for both the mobile drawer (opened via hamburger) and the
 * persistent desktop sidebar. The main হোম/সিরিয়াল/প্রোফাইল links only
 * render on md+ since mobile already has them in CustomerBottomNav.
 */
export function CustomerSidebarPanel({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: profile } = useMyProfile();
  const { data: activeSerial } = useMyActiveSerial();
  const logout = useLogout();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto bg-ink px-4 py-5.5 text-paper md:w-59">
      <Link href="/profile" onClick={onNavigate} className="flex items-center gap-2.75 px-2 pb-5.5">
        <div className="grid h-10.5 w-10.5 shrink-0 place-items-center rounded-[13px] bg-accent font-display text-xl font-extrabold text-accent-ink">
          {profile?.full_name?.trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-bold">
            {profile?.full_name || "কাস্টমার"}
          </p>
          <p className="truncate text-[11px] text-paper/50">{profile?.phone || "—"}</p>
        </div>
      </Link>

      <nav className="hidden flex-col gap-0.75 md:flex">
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
                  : "font-medium text-paper/70 hover:bg-white/5",
              )}
            >
              <span className="relative w-4 text-center text-[15px] leading-none">
                {item.icon}
                {item.href === "/my-serial" && activeSerial && (
                  <span className="absolute -right-1 -top-1 h-1.75 w-1.75 rounded-full bg-live" />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.75 border-t border-white/10 pt-3 md:mt-3">
        <Link
          href="/account"
          onClick={onNavigate}
          className="flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-sm font-medium text-paper/70 hover:bg-white/5"
        >
          <UserRound className="h-4 w-4" />
          অ্যাকাউন্ট ও সেটিংস
        </Link>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-left text-sm font-medium text-paper/70 hover:bg-white/5 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {logout.isPending ? "…" : "লগ-আউট"}
        </button>
      </div>
    </aside>
  );
}
