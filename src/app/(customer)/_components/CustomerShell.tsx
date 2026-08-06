"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/Wordmark";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useT } from "@/lib/i18n";
import { CustomerBottomNav } from "./CustomerBottomNav";
import { CustomerSidebarPanel } from "./CustomerSidebarPanel";
import { customerShellDict } from "./i18n";

// The messages split-panel (list + thread side by side) needs real desktop
// width — every other customer page is intentionally capped at max-w-md.
function isChatRoute(pathname: string): boolean {
  return pathname === "/chats" || /^\/explore\/[^/]+\/chat$/.test(pathname);
}

/**
 * What a visitor with no account sees on the one page that welcomes them —
 * a shop opened from its QR poster. The signed-in chrome would be a lie here:
 * a profile, a notification bell and a log-out button belong to an account
 * this person does not have. They get the brand and a way in instead.
 */
function GuestShell({ children }: { children: React.ReactNode }) {
  const t = useT(customerShellDict);

  return (
    <div className="min-h-dvh">
      <div className="flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <Link href="/login">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-[14px] px-3 py-2 text-[13px] font-semibold text-muted hover:bg-soft"
          >
            {t("guestLogin")}
          </Link>
          <Link
            href="/register"
            className="rounded-[14px] bg-accent px-3.5 py-2 text-[13px] font-bold text-accent-ink hover:opacity-90"
          >
            {t("guestSignUp")}
          </Link>
        </div>
      </div>

      <main className="mx-auto min-w-0 max-w-md px-4 pt-6 pb-10">{children}</main>
    </div>
  );
}

/**
 * @param signedIn defaults to true because every other caller
 *   (SharedPageShell, /account) sits behind a route middleware already
 *   requires a session for. Only the (customer) layout, which serves the one
 *   publicly reachable page, passes it.
 */
export function CustomerShell({
  signedIn = true,
  children,
}: {
  signedIn?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useT(customerShellDict);

  if (!signedIn) return <GuestShell>{children}</GuestShell>;

  return (
    <div className="min-h-dvh lg:flex">
      <div className="flex items-center justify-between border-b border-line bg-card px-4 py-3 lg:hidden">
        <Wordmark size="sm" />
        <div className="flex items-center gap-1">
          <NotificationBell className="text-ink hover:bg-soft" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("openMenu")}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink hover:bg-soft"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open && (
        <button
          type="button"
          aria-label={t("closeMenu")}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/50 lg:hidden"
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-40 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <CustomerSidebarPanel onNavigate={() => setOpen(false)} />
      </div>

      <main
        className={cn(
          "mx-auto min-w-0 flex-1 px-4 pt-6 pb-28 lg:pb-10",
          isChatRoute(pathname) ? "max-w-4xl" : "max-w-md",
        )}
      >
        {children}
      </main>

      <CustomerBottomNav />
    </div>
  );
}
