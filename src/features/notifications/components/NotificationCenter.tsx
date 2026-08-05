"use client";

import {
  Bell,
  Calendar,
  CheckCheck,
  Megaphone,
  PartyPopper,
  Radio,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { formatBanglaDate } from "@/lib/format-wait";
import type { Notification, NotificationType } from "@/types";
import { getStoredLanguage, translate, useT } from "@/lib/i18n";
import { useMyNotifications } from "../hooks/use-notifications";
import { notificationsDict } from "../lib/i18n";

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  SERIAL_CONFIRMED: <CheckCheck className="h-4.5 w-4.5" />,
  QUEUE_UPDATE: <Bell className="h-4.5 w-4.5" />,
  YOUR_TURN: <PartyPopper className="h-4.5 w-4.5" />,
  CANCELLED: <XCircle className="h-4.5 w-4.5" />,
  PROMO: <Megaphone className="h-4.5 w-4.5" />,
  REMINDER: <Radio className="h-4.5 w-4.5" />,
  SYSTEM: <ShieldCheck className="h-4.5 w-4.5" />,
};

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return translate(notificationsDict, "today");
  if (diffDays === 1) return translate(notificationsDict, "yesterday");
  if (getStoredLanguage() === "en") {
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }
  return formatBanglaDate(d);
}

function groupByDay(items: Notification[]): Array<[string, Notification[]]> {
  const groups = new Map<string, Notification[]>();
  for (const n of items) {
    const label = dayLabel(n.created_at);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(n);
  }
  return [...groups.entries()];
}

export function NotificationCenter() {
  const { notifications, unreadCount, isPending, markRead, markAllRead } = useMyNotifications();
  const t = useT(notificationsDict);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="h-6 w-6" />}
        title={t("noNotificationsTitle")}
        description={t("noNotificationsDesc")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-ink">{t("notificationsHeading")}</h1>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs font-semibold text-accent disabled:opacity-50"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4.5">
        {groupByDay(notifications).map(([label, items]) => (
          <div key={label}>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase">
              <Calendar className="h-3 w-3" />
              {label}
            </p>
            <div className="flex flex-col gap-2">
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.read_at && markRead.mutate(n.id)}
                  className="flex items-start gap-3 rounded-[14px] border border-line bg-card p-3.25 text-left"
                  style={{ opacity: n.read_at ? 0.6 : 1 }}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                    {TYPE_ICON[n.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink">{n.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{n.body}</p>
                  </div>
                  {!n.read_at && (
                    <span className="mt-1.5 h-1.75 w-1.75 shrink-0 rounded-full bg-live" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
