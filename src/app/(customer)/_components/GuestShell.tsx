"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/Wordmark";
import { useT } from "@/lib/i18n";
import { customerShellDict } from "./i18n";

/**
 * The chrome for someone who has not signed in.
 *
 * Deliberately not a stripped-down copy of the customer shell. Everything in
 * that one — the avatar, the notification bell, the log-out button, the bottom
 * nav pointing at "my serial" — describes an account, and showing any of it to
 * a visitor is a small lie that makes the whole screen untrustworthy. This
 * carries only what a visitor can actually use, and says plainly that they are
 * browsing as a guest.
 */
const NAV = [
  { href: "/", key: "guestNavExplore" as const, exact: true },
  { href: "/about", key: "guestNavAbout" as const, exact: true },
  { href: "/about#help", key: "guestNavHelp" as const, exact: false },
];

export function GuestShell({ children }: { children: React.ReactNode }) {
  const t = useT(customerShellDict);
  const pathname = usePathname();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="shrink-0">
            <Wordmark size="sm" />
          </Link>

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {NAV.map((item) => {
              const active = item.exact && pathname === item.href;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors",
                    active ? "bg-soft text-ink" : "text-muted hover:bg-soft hover:text-ink",
                  )}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="rounded-[14px] px-3 py-2 text-[13px] font-semibold text-muted hover:bg-soft hover:text-ink"
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

        {/* The same links on small screens, where they don't fit beside the
            brand. A row rather than a hamburger: three items don't earn a
            menu, and a guest should see where they can go without tapping. */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-line px-4 py-1.5 sm:hidden">
          {NAV.map((item) => {
            const active = item.exact && pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold",
                  active ? "bg-soft text-ink" : "text-muted",
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto min-w-0 max-w-md px-4 pt-6 pb-12">{children}</main>

      <footer className="border-t border-line px-4 py-6">
        <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">{t("guestFooterNote")}</p>
          <Link
            href="/register"
            className="text-[13px] font-bold text-accent hover:underline"
          >
            {t("guestSignUp")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
