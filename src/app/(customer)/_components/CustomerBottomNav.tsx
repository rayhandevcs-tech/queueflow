"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMyActiveSerial } from "@/features/customer-booking/hooks/use-my-serial";

const ITEMS = [
  { href: "/explore", icon: "⌂", label: "হোম" },
  { href: "/my-serial", icon: "◉", label: "সিরিয়াল" },
  { href: "/profile", icon: "○", label: "প্রোফাইল" },
] as const;

export function CustomerBottomNav() {
  const pathname = usePathname();
  const { data: activeSerial } = useMyActiveSerial();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card">
      <div className="mx-auto flex max-w-md px-6 pb-6 pt-2.5">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 p-1 text-[10px]",
                active ? "font-bold text-accent" : "font-medium text-muted",
              )}
            >
              <span className="relative text-[19px] leading-none">
                {item.icon}
                {item.href === "/my-serial" && activeSerial && (
                  <span className="absolute -right-1 -top-0.5 h-1.75 w-1.75 rounded-full bg-live" />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
