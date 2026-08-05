"use client";

import { cn } from "@/lib/utils";
import type { Chair, Service } from "@/types";
import type { ServiceCategory } from "@/config/constants";
import { SERVICE_CATEGORY_ICON } from "@/lib/service-category-icon";
import { useT } from "@/lib/i18n";
import { customerBookingDict } from "../lib/i18n";

interface Props {
  services: Service[] | undefined;
  selected: Set<string>;
  onToggle: (id: string) => void;
  eligibleChairs: Chair[];
  preferredChairId: string | null;
  onPreferredChairChange: (chairId: string | null) => void;
  advance: boolean;
  onAdvanceChange: (advance: boolean) => void;
}

export function ServicesTab({
  services,
  selected,
  onToggle,
  eligibleChairs,
  preferredChairId,
  onPreferredChairChange,
  advance,
  onAdvanceChange,
}: Props) {
  const t = useT(customerBookingDict);
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2.5 text-[13px] font-semibold tracking-wide text-muted uppercase">
          {t("chooseServicesLabel")}
        </p>

        {!services?.length ? (
          <p className="text-sm text-muted">{t("noServicesAtShop")}</p>
        ) : (
          <div className="flex flex-col gap-2.25">
            {services.map((s) => {
              const on = selected.has(s.id);
              const CategoryIcon = SERVICE_CATEGORY_ICON[(s.category as ServiceCategory) ?? "OTHER"];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onToggle(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[14px] border p-3.5 text-left transition-all",
                    on ? "border-accent bg-accent/[0.07]" : "border-line bg-card",
                  )}
                  style={{ borderWidth: 1.5 }}
                >
                  <div className="grid h-10.5 w-10.5 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-soft text-muted">
                    {s.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <CategoryIcon className="h-4.5 w-4.5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-sm font-bold text-white",
                      on ? "border-accent bg-accent" : "border-line bg-transparent",
                    )}
                    style={{ borderWidth: 1.5 }}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{s.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {t("minutesSuffix", s.default_duration_min)}
                    </span>
                  </span>
                  <span className="font-number text-[15px] font-semibold text-ink">
                    ৳{s.rate}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div>
          <p className="mb-2.5 text-[13px] font-semibold tracking-wide text-muted uppercase">
            {t("preferredStaffLabel")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPreferredChairChange(null)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                preferredChairId === null
                  ? "border-accent bg-accent text-accent-ink shadow-sm"
                  : "border-line bg-card text-muted hover:border-accent/40",
              )}
            >
              {t("autoBestMatch")}
            </button>
            {eligibleChairs.map((chair) => (
              <button
                key={chair.id}
                type="button"
                onClick={() => onPreferredChairChange(chair.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                  preferredChairId === chair.id
                    ? "border-accent bg-accent text-accent-ink shadow-sm"
                    : "border-line bg-card text-muted hover:border-accent/40",
                )}
              >
                {chair.staff_name || chair.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="rounded-2xl border border-line bg-soft p-3.5">
          <label className="flex cursor-pointer items-center gap-3">
            <span
              className="relative inline-block h-6 w-10.5 shrink-0 rounded-full transition-colors"
              style={{ background: advance ? "var(--color-accent)" : "var(--color-line)" }}
            >
              <input
                type="checkbox"
                checked={advance}
                onChange={(e) => onAdvanceChange(e.target.checked)}
                className="sr-only"
              />
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                style={{ left: advance ? "22px" : "2px" }}
              />
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-semibold text-ink">
                {t("advanceLockLabel")}
              </span>
              <span className="block text-[11px] text-muted">{t("advanceLockHint")}</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
