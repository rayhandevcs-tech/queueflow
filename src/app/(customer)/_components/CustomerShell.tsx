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
import { HelpChatWidget } from "@/features/customer-help/components/HelpChatWidget";
import { CustomerSidebarPanel } from "./CustomerSidebarPanel";
import { GuestShell } from "./GuestShell";
import { customerShellDict } from "./i18n";

// The messages split-panel (list + thread side by side) needs real desktop
// width — every other customer page is intentionally capped at max-w-md.
function isChatRoute(pathname: string): boolean {
  return pathname === "/chats" || /^\/explore\/[^/]+\/chat$/.test(pathname);
}

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
        <Link href="/explore">
          <Wordmark size="sm" />
        </Link>
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

      {/* Signed-in only: the assistant answers from the customer's own
          bookings and dues, which a guest does not have. */}
      <HelpChatWidget />
    </div>
  );
}
