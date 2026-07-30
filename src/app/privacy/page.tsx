"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { LegalContentView } from "@/features/support/components/LegalContentView";
import { PRIVACY_SECTIONS } from "@/features/support/lib/legal-content";
import { supportDict } from "@/features/support/lib/i18n";
import { useT } from "@/lib/i18n";

export default function PrivacyPage() {
  const t = useT(supportDict);
  return (
    <SharedPageShell title={t("privacyPolicyTitle")}>
      <LegalContentView intro={t("privacyIntro")} sections={PRIVACY_SECTIONS} />
    </SharedPageShell>
  );
}
