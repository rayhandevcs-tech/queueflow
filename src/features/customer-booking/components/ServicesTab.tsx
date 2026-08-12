"use client";

import { Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Chair, Service } from "@/types";
import type { ServiceCategory } from "@/config/constants";
import { SERVICE_CATEGORY_ICON } from "@/lib/service-category-icon";
import { ServiceCard, ServiceCardGrid } from "@/components/ui/ServiceCard";
import { useT } from "@/lib/i18n";
import { customerBookingDict } from "../lib/i18n";

interface Props {
  services: Service[] | undefined;
  selected: Set<string>;
  onToggle: (id: string) => void;
  eligibleChairs: Chair[];
  /** Optional: shown as a badge on each staff card when a rating exists. */
  ratingByChairId?: Map<string, { avg_rating: number }>;
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
  ratingByChairId,
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
          <ServiceCardGrid>
            {services.map((s) => {
              const on = selected.has(s.id);
              const CategoryIcon = SERVICE_CATEGORY_ICON[(s.category as ServiceCategory) ?? "OTHER"];
              return (
                <ServiceCard
                  key={s.id}
                  name={s.name}
                  imageUrl={s.image_url}
                  fallbackIcon={<CategoryIcon className="h-7 w-7" />}
                  durationLabel={t("minutesSuffix", s.default_duration_min)}
                  priceLabel={`৳${s.rate}`}
                  selectable
                  selected={on}
                  onClick={() => onToggle(s.id)}
                />
              );
            })}
          </ServiceCardGrid>
        )}
      </div>

      {selected.size > 0 && (
        <div>
          <p className="mb-2.5 text-[13px] font-semibold tracking-wide text-muted uppercase">
            {t("preferredStaffLabel")}
          </p>
          {/* Cards, not name chips. Picking a barber is a decision made by
              looking at a face and a rating — a row of bare names gave you
              nothing to decide on. Same shape as the Staff tab, so the person
              you liked there is recognisable here. */}
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => onPreferredChairChange(null)}
              className={cn(
                "rounded-[16px] border p-2 text-center transition-all",
                preferredChairId === null
                  ? "border-accent bg-accent/[0.07]"
                  : "border-line bg-card hover:bg-soft",
              )}
              style={{ borderWidth: 1.5 }}
            >
              <span className="grid aspect-square w-full place-items-center rounded-[12px] bg-soft text-accent">
                <Sparkles className="h-6 w-6" />
              </span>
              <span className="mt-1.5 block truncate text-[11px] font-bold text-ink">
                {t("autoBestMatch")}
              </span>
            </button>

            {eligibleChairs.map((chair) => {
              const rating = ratingByChairId?.get(chair.id);
              const on = preferredChairId === chair.id;
              return (
                <button
                  key={chair.id}
                  type="button"
                  onClick={() => onPreferredChairChange(chair.id)}
                  className={cn(
                    "rounded-[16px] border p-2 text-center transition-all",
                    on ? "border-accent bg-accent/[0.07]" : "border-line bg-card hover:bg-soft",
                  )}
                  style={{ borderWidth: 1.5 }}
                >
                  <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-[12px] bg-accent font-display text-xl font-extrabold text-white">
                    {chair.staff_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={chair.staff_avatar_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (chair.staff_name || chair.label).trim().charAt(0).toUpperCase() || "?"
                    )}
                    {rating && (
                      <span className="absolute right-1 bottom-1 flex items-center gap-0.5 rounded-full bg-card/95 px-1.5 py-0.5 text-[10px] font-bold text-brass shadow-xs backdrop-blur-sm">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        {rating.avg_rating}
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-[11px] font-bold text-ink">
                    {chair.staff_name || chair.label}
                  </span>
                </button>
              );
            })}
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
