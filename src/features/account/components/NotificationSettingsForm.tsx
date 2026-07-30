"use client";

import { Bell, Megaphone, PartyPopper, Radio, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Spinner } from "@/components/ui/Spinner";
import type { Json, NotificationPrefs, NotificationType } from "@/types";
import { useT } from "@/lib/i18n";
import { useMyProfile } from "../hooks/use-my-profile";
import { useUpdateMyNotificationPrefs } from "../hooks/use-profile-mutations";
import { accountDict } from "../lib/i18n";

function parsePrefs(raw: Json | null | undefined): NotificationPrefs {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as NotificationPrefs) : {};
}

export function NotificationSettingsForm() {
  const { data: profile, isPending } = useMyProfile();
  const update = useUpdateMyNotificationPrefs();
  const t = useT(accountDict);

  const TOGGLEABLE: Array<{
    type: NotificationType;
    icon: React.ReactNode;
    label: string;
    hint: string;
  }> = [
    {
      type: "QUEUE_UPDATE",
      icon: <Bell className="h-4.5 w-4.5" />,
      label: t("queueUpdateLabel"),
      hint: t("queueUpdateHint"),
    },
    {
      type: "YOUR_TURN",
      icon: <PartyPopper className="h-4.5 w-4.5" />,
      label: t("yourTurnLabel"),
      hint: t("yourTurnHint"),
    },
    {
      type: "CANCELLED",
      icon: <XCircle className="h-4.5 w-4.5" />,
      label: t("cancelledLabel"),
      hint: t("cancelledHint"),
    },
    {
      type: "PROMO",
      icon: <Megaphone className="h-4.5 w-4.5" />,
      label: t("promoLabel"),
      hint: t("promoHint"),
    },
    {
      type: "REMINDER",
      icon: <Radio className="h-4.5 w-4.5" />,
      label: t("reminderLabel"),
      hint: t("reminderHint"),
    },
  ];

  if (isPending) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  const prefs = parsePrefs(profile?.notification_prefs);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{t("notifAlwaysOnNote")}</p>
      {TOGGLEABLE.map((item) => {
        const enabled = prefs[item.type] !== false;
        return (
          <div
            key={item.type}
            className="flex items-center gap-3 rounded-[14px] border border-line bg-card p-3.5"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{item.label}</p>
              <p className="text-xs text-muted">{item.hint}</p>
            </div>
            <Switch
              checked={enabled}
              disabled={update.isPending}
              onChange={(next) => update.mutate({ ...prefs, [item.type]: next })}
            />
          </div>
        );
      })}
    </div>
  );
}
