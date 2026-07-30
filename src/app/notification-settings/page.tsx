"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { NotificationSettingsForm } from "@/features/account/components/NotificationSettingsForm";
import { supportDict } from "@/features/support/lib/i18n";
import { useT } from "@/lib/i18n";

export default function NotificationSettingsPage() {
  const t = useT(supportDict);
  return (
    <SharedPageShell title={t("notificationSettingsTitle")}>
      <NotificationSettingsForm />
    </SharedPageShell>
  );
}
