"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMyActiveSerial } from "@/features/customer-booking/hooks/use-my-serial";
import { useMyUnreadChatCount } from "@/features/chat/hooks/use-chat-threads";
import { CUSTOMER_NAV_ITEMS } from "./customer-nav-items";

export function CustomerBottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { data: activeSerial } = useMyActiveSerial();
  const unreadChatCount = useMyUnreadChatCount();

  return (
    <nav className={cn("fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card lg:hidden", className)}>
      <div className="mx-auto flex max-w-md px-6 pb-6 pt-2.5">
        {CUSTOMER_NAV_ITEMS.map((item) => {
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
                {item.href === "/chats" && unreadChatCount > 0 && (
                  <span className="absolute -right-1 -top-0.5 h-1.75 w-1.75 rounded-full bg-accent" />
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
