"use client";

import { Flower2, LayoutGrid, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

export type BusinessTypeFilter = "ALL" | "SALON" | "PARLOUR";

/**
 * Salon / parlour / everything, as three chips with counts.
 *
 * It opens on **everything**, always — even for a customer who told us at
 * signup that they came for a parlour. That is deliberate and it is the line
 * this sprint was careful about: the preference decides what a customer sees
 * *first* (parlours are sorted to the top of the list below, the bookings page
 * leads with appointments, the nav says "Appointments"), and it must never
 * decide what exists. A tab pre-selected to "Parlour" would have hidden every
 * salon behind a control most people never touch, and "I also want a haircut"
 * would have looked like the wrong account.
 *
 * So: ordering follows the preference, filtering follows the tap. The counts
 * are there so the chips are honest about what switching would show — a
 * "Parlour (0)" chip tells you not to bother.
 *
 * A row rather than a dropdown, and it wraps rather than scrolls: three short
 * chips fit a 320px screen on one line, and anything hidden behind a scroll
 * edge on a filter bar might as well not exist.
 */
export function BusinessTypeFilterRow({
  value,
  onChange,
  counts,
  className,
}: {
  value: BusinessTypeFilter;
  onChange: (value: BusinessTypeFilter) => void;
  counts: Record<BusinessTypeFilter, number>;
  className?: string;
}) {
  const t = useT(customerExploreDict);

  const OPTIONS: ReadonlyArray<{
    value: BusinessTypeFilter;
    label: string;
    icon: typeof LayoutGrid;
  }> = [
    { value: "ALL", label: t("typeFilterAll"), icon: LayoutGrid },
    { value: "SALON", label: t("typeFilterSalon"), icon: Scissors },
    { value: "PARLOUR", label: t("typeFilterParlour"), icon: Flower2 },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t("typeFilterAria")}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {OPTIONS.map((option) => {
        const active = value === option.value;
        const count = counts[option.value] ?? 0;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
              active
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-card text-muted hover:border-accent/40 hover:text-ink",
            )}
          >
            <option.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{option.label}</span>
            <span className={cn("font-number text-[11px]", active ? "opacity-80" : "opacity-70")}>
              {toBanglaDigits(count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** `ALL` matches everything; a unisex shop counts for both named kinds. */
export function matchesTypeFilter(
  businessType: string | null | undefined,
  filter: BusinessTypeFilter,
): boolean {
  if (filter === "ALL") return true;
  if (businessType === "UNISEX") return true;
  return businessType === filter;
}
