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
 * ---------------------------------------------------------------------------
 * It now OPENS on the customer's own preference. This reverses Sprint 11.
 * ---------------------------------------------------------------------------
 * Sprint 11 deliberately opened this on "everything", even for a customer who
 * had said at signup that they came for a parlour, on the grounds that a
 * pre-selected tab would hide every salon behind a control most people never
 * touch. The polish sprint that followed reversed it on purpose: a parlour
 * customer was getting a home page indistinguishable from a salon customer's,
 * which made answering the question at signup feel pointless.
 *
 * So the preference now decides the opening view, and the original worry is
 * answered directly rather than by refusing the feature:
 *
 *   · "All" is one tap away and always present, with a live count on it, so
 *     the other ecosystem is visibly there rather than merely reachable.
 *   · While the preference is what is deciding, the caller prints a line that
 *     says so and says how to see everything. A default you cannot find your
 *     way out of is the actual failure mode.
 *   · The moment the customer taps any chip, their tap wins for the rest of
 *     the session — the preference never overrides a person's own choice.
 *
 * What has NOT changed is the part that was never negotiable: this is a view
 * filter and nothing else. No query is scoped by it, no RLS policy reads
 * `preferred_business_type`, and every shop on the platform stays reachable by
 * search, by the map, by a link and by this row. Preference is a default, not
 * a permission.
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
