"use client";

import { useLanguage } from "@/lib/i18n";
import type { LegalSection } from "../lib/legal-content";

export function LegalContentView({
  intro,
  sections,
}: {
  intro?: string;
  sections: LegalSection[];
}) {
  const { language } = useLanguage();

  return (
    <div className="space-y-4">
      {intro && <p className="text-sm leading-relaxed text-muted">{intro}</p>}
      {sections.map((s) => (
        <div key={s.heading.bn} className="rounded-[18px] border border-line bg-card p-5">
          <p className="mb-2 text-sm font-bold text-ink">{s.heading[language]}</p>
          <p className="text-sm leading-relaxed text-muted">{s.body[language]}</p>
        </div>
      ))}
    </div>
  );
}
