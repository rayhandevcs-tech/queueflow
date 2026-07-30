"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { LegalContentView } from "@/features/support/components/LegalContentView";
import { TERMS_SECTIONS } from "@/features/support/lib/legal-content";
import { supportDict } from "@/features/support/lib/i18n";
import { useT } from "@/lib/i18n";

export default function TermsPage() {
  const t = useT(supportDict);
  return (
    <SharedPageShell title={t("termsTitle")}>
      <LegalContentView intro={t("termsIntro")} sections={TERMS_SECTIONS} />
    </SharedPageShell>
  );
}
