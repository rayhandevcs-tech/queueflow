"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { LegalContentView } from "@/features/support/components/LegalContentView";
import { CANCELLATION_SECTIONS } from "@/features/support/lib/legal-content";
import { supportDict } from "@/features/support/lib/i18n";
import { useT } from "@/lib/i18n";

export default function CancellationPolicyPage() {
  const t = useT(supportDict);
  return (
    <SharedPageShell title={t("cancellationPolicyTitle")}>
      <LegalContentView sections={CANCELLATION_SECTIONS} />
    </SharedPageShell>
  );
}
