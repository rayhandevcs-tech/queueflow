"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage, useT } from "@/lib/i18n";
import { customerBookingDict } from "../lib/i18n";
import { useServiceStyleOptions } from "../hooks/use-service-styles";

/**
 * "Which style?", asked only when the shop has an answer.
 *
 * Three rules make this safe to add to a flow that has worked for eleven
 * sprints without it:
 *
 *   · It renders NOTHING when the selected services have no styles configured.
 *     Every service that existed before 20260929 is in that state, so the
 *     queue flow is byte-for-byte what it was for them.
 *   · It is never required. The brief was explicit, and it is the right call:
 *     a customer who does not know what a mid fade is should not be blocked
 *     from getting a haircut.
 *   · The list is the shop's, not the platform's. Shop A's haircut and shop
 *     B's haircut can offer different styles, and a customer only ever sees
 *     the one belonging to the shop they are standing in.
 *
 * Grouped by service rather than pooled, because "Low Fade" under Haircut and
 * "Beard Trim shaping" under Beard Trim are answers to different questions,
 * and one flat row of chips would invite picking the wrong one.
 */
export function StylePicker({
  serviceIds,
  serviceNameById,
  value,
  onChange,
}: {
  serviceIds: string[];
  serviceNameById: Map<string, string>;
  /** hairstyle_id, or null for "did not choose". */
  value: string | null;
  onChange: (hairstyleId: string | null) => void;
}) {
  const t = useT(customerBookingDict);
  const { language } = useLanguage();
  const { data: options } = useServiceStyleOptions(serviceIds);

  if (!options?.length) return null;

  const byService = new Map<string, typeof options>();
  for (const option of options) {
    const list = byService.get(option.service_id) ?? [];
    list.push(option);
    byService.set(option.service_id, list);
  }

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
          {t("chooseStyleLabel")}
        </p>
        <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-muted">
          {t("chooseStyleOptional")}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-auto text-[12px] font-semibold text-accent hover:underline"
          >
            {t("styleClear")}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {[...byService.entries()].map(([serviceId, list]) => (
          <div key={serviceId}>
            {/* Only worth naming the service when more than one is in play. */}
            {byService.size > 1 && (
              <p className="mb-1.5 text-[12px] font-semibold text-ink">
                {serviceNameById.get(serviceId) ?? ""}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {list.map((option) => {
                const on = value === option.hairstyle_id;
                return (
                  <button
                    key={option.hairstyle_id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange(on ? null : option.hairstyle_id)}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                      on
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line bg-card text-ink hover:border-accent/40 hover:bg-soft",
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                    {language === "bn" ? option.name_bn : option.name_en}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[12px] leading-snug text-muted">{t("chooseStyleHint")}</p>
    </div>
  );
}
