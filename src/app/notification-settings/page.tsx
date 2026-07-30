"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { NotificationSettingsForm } from "@/features/account/components/NotificationSettingsForm";

export default function NotificationSettingsPage() {
  return (
    <SharedPageShell title="নোটিফিকেশন সেটিংস">
      <NotificationSettingsForm />
    </SharedPageShell>
  );
}
