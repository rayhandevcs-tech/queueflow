"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyNotifications } from "../hooks/use-notifications";

export function NotificationBell({ className }: { className?: string }) {
  const { unreadCount } = useMyNotifications();

  return (
    <Link
      href="/notifications"
      aria-label="নোটিফিকেশন"
      className={cn("relative grid h-9 w-9 shrink-0 place-items-center rounded-lg", className)}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-live px-1 font-number text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
