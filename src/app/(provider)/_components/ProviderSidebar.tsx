"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Armchair,
  BarChart3,
  LogOut,
  Radio,
  Scissors,
  Settings as SettingsIcon,
  Star,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format-wait";
import { useMyShop, useShopMutations } from "@/features/provider-catalog/hooks/use-my-shop";
import { useLiveQueueCount, useTodaySummary } from "@/features/provider-queue/hooks/use-sidebar-stats";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useToast } from "@/components/ui/Toast";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Radio;
  live?: boolean;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "লাইভ সিরিয়াল", icon: Radio, live: true },
  { href: "/chairs", label: "চেয়ার", icon: Armchair },
  { href: "/services", label: "সার্ভিস ও রেট", icon: Scissors },
  { href: "/income", label: "ইনকাম", icon: Wallet },
  { href: "/analytics", label: "অ্যানালিটিক্স", icon: BarChart3 },
  { href: "/regulars", label: "নিয়মিত কাস্টমার", icon: Users },
  { href: "/reviews", label: "রিভিউ", icon: Star, soon: true },
  { href: "/settings", label: "সেটিংস", icon: SettingsIcon },
];

export function ProviderSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const showToast = useToast();
  const { data: shop } = useMyShop();
  const { update } = useShopMutations();
  const liveCount = useLiveQueueCount(shop?.id);
  const today = useTodaySummary(shop?.id);
  const logout = useLogout();

  return (
    <aside className="flex h-full w-59 shrink-0 flex-col overflow-y-auto bg-ink px-4 py-5.5 text-paper">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.75 px-2 pb-5.5">
        <div className="grid h-10.5 w-10.5 shrink-0 place-items-center rounded-[13px] bg-accent font-display text-xl font-extrabold text-accent-ink">
          {shop?.name?.trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-bold">{shop?.name ?? "…"}</p>
          <button
            type="button"
            disabled={!shop || update.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (shop) update.mutate({ shopId: shop.id, patch: { is_open: !shop.is_open } });
            }}
            className="truncate text-[11px] text-paper/50 hover:text-paper/80 disabled:pointer-events-none"
          >
            {shop?.address ? `${shop.address} · ` : ""}
            {shop?.is_open ? "খোলা" : "বন্ধ"}
          </button>
        </div>
      </Link>

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
                  showToast(`${item.label} — শীঘ্রই আসছে`);
                  onNavigate?.();
                }}
                className="flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-left text-sm font-medium text-paper/40"
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
                "flex items-center gap-2.75 rounded-xl px-3.25 py-2.75 text-sm transition-colors",
                active
                  ? "bg-accent font-bold text-accent-ink"
                  : "font-medium text-paper/70 hover:bg-white/5",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {item.live && liveCount > 0 && (
                <span className="ml-auto rounded-full bg-live px-2 py-0.5 font-number text-[11px] font-bold text-white">
                  {liveCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[14px] bg-white/7 p-3.5">
        <p className="text-[11px] text-paper/50">আজকের আয়</p>
        <p className="font-number text-2xl font-bold text-good">৳{formatMoney(today.income)}</p>
        <p className="mt-0.5 text-[11px] text-paper/50">{today.doneCount} টি কাজ সম্পন্ন</p>
      </div>

      <div className="mt-3 flex items-center gap-1 px-1">
        <Link
          href="/account"
          onClick={onNavigate}
          className="flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-paper/50 hover:bg-white/5 hover:text-paper/80"
        >
          <UserRound className="h-3.5 w-3.5" />
          একাউন্ট
        </Link>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-paper/50 hover:bg-white/5 hover:text-paper/80 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {logout.isPending ? "…" : "সাইন আউট"}
        </button>
      </div>
    </aside>
  );
}
