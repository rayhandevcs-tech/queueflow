"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { HelpCenterView } from "@/features/support/components/HelpCenterView";
import { supportDict } from "@/features/support/lib/i18n";
import { useT } from "@/lib/i18n";

export default function HelpPage() {
  const t = useT(supportDict);
  return (
    <SharedPageShell title={t("helpCenterTitle")}>
      <HelpCenterView />
    </SharedPageShell>
  );
}
