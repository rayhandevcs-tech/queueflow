"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { LegalContentView } from "@/features/support/components/LegalContentView";
import { CANCELLATION_SECTIONS } from "@/features/support/lib/legal-content";

export default function CancellationPolicyPage() {
  return (
    <SharedPageShell title="বাতিল নীতি">
      <LegalContentView sections={CANCELLATION_SECTIONS} />
    </SharedPageShell>
  );
}
