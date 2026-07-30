"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { LegalContentView } from "@/features/support/components/LegalContentView";
import { PRIVACY_SECTIONS } from "@/features/support/lib/legal-content";

export default function PrivacyPage() {
  return (
    <SharedPageShell title="গোপনীয়তা নীতি">
      <LegalContentView
        intro="তোমার তথ্য কীভাবে রাখা ও ব্যবহার করা হয়, তার সংক্ষিপ্ত বিবরণ।"
        sections={PRIVACY_SECTIONS}
      />
    </SharedPageShell>
  );
}
