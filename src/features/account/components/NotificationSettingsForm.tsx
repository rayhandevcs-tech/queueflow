"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Megaphone, PartyPopper, Radio, Share, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import type { Json, NotificationPrefs, NotificationType } from "@/types";
import { useT } from "@/lib/i18n";
import { useMyProfile } from "../hooks/use-my-profile";
import { useUpdateMyNotificationPrefs } from "../hooks/use-profile-mutations";
import { usePushSubscription } from "../hooks/use-push-subscription";
import { accountDict } from "../lib/i18n";

function parsePrefs(raw: Json | null | undefined): NotificationPrefs {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as NotificationPrefs) : {};
}

function PushNotificationSection() {
  const { status, isPending, error, subscribe, unsubscribe } = usePushSubscription();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const t = useT(accountDict);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    // One-time hydration-safe check: SSR always renders `false`, this reads the
    // real client-only browser state right after mount (same pattern as LanguageProvider).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowIOSHint(isIOS && !isStandalone);
  }, []);

  return (
    <div className="rounded-[14px] border border-line bg-card p-3.5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <BellRing className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t("pushSectionTitle")}</p>
          <p className="text-xs text-muted">
            {status === "subscribed" ? t("pushEnabledStatus") : t("pushSectionHint")}
          </p>
        </div>
        {status === "loading" && <Spinner className="h-4 w-4 text-muted" />}
        {status === "subscribed" && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => void unsubscribe()}>
            {isPending ? t("pushDisabling") : t("pushDisableCta")}
          </Button>
        )}
        {status === "unsubscribed" && (
          <Button size="sm" disabled={isPending} onClick={() => void subscribe()}>
            {isPending ? t("pushEnabling") : t("pushEnableCta")}
          </Button>
        )}
      </div>
      {status === "unsupported" && <p className="mt-2 text-xs text-muted">{t("pushUnsupported")}</p>}
      {status === "denied" && <p className="mt-2 text-xs text-live">{t("pushPermissionDenied")}</p>}
      {error && <p className="mt-2 text-xs text-live">{error}</p>}
      {showIOSHint && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <Share className="h-3.5 w-3.5 shrink-0" />
          {t("installPromptIOSHint")}
        </p>
      )}
    </div>
  );
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
      <PushNotificationSection />
      <p className="pt-1 text-sm text-muted">{t("notifAlwaysOnNote")}</p>
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
