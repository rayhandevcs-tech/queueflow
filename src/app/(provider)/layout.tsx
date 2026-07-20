"use client";

import Link from "next/link";
import {
  Armchair,
  BarChart3,
  LayoutGrid,
  ListChecks,
  LogOut,
  Settings as SettingsIcon,
  UserRound,
} from "lucide-react";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { Logo } from "@/components/ui/Logo";
import { NavLink } from "@/components/ui/NavLink";
import { Button } from "@/components/ui/Button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/services", label: "Services", icon: ListChecks },
  { href: "/chairs", label: "Chairs", icon: Armchair },
  { href: "/summary", label: "Summary", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const logout = useLogout();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <nav className="flex gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.href} href={item.href}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <NavLink href="/account">
              <UserRound className="h-4 w-4" />
              Account
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut className="h-3.5 w-3.5" />
              {logout.isPending ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
