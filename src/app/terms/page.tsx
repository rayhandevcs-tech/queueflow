"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { LegalContentView } from "@/features/support/components/LegalContentView";
import { TERMS_SECTIONS } from "@/features/support/lib/legal-content";

export default function TermsPage() {
  return (
    <SharedPageShell title="ব্যবহারের শর্তাবলী">
      <LegalContentView
        intro="এই অ্যাপ ব্যবহার করার আগে নিচের শর্তগুলো পড়ে নাও।"
        sections={TERMS_SECTIONS}
      />
    </SharedPageShell>
  );
}
