"use client";

import { SERVICE_CATEGORY_LABEL, type ServiceCategory } from "@/config/constants";
import { SERVICE_CATEGORY_ICON } from "@/lib/service-category-icon";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/**
 * The service category picker.
 *
 * A wrapping row of pills rather than `ChipGroup`: that component is a
 * segmented control built for two or three options with a sliding thumb, and
 * twelve categories would squash it into an unreadable grid. This keeps the
 * app's pill shape, radius and tones — the same treatment the explore page's
 * category shortcuts and the filter sheet already use.
 *
 * Which categories arrive here is the caller's business (`categoriesFor`);
 * this only draws them.
 */
export function CategoryPicker({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly ServiceCategory[];
  value: ServiceCategory | null | undefined;
  onChange: (value: ServiceCategory) => void;
  ariaLabel: string;
}) {
  const label = useT(SERVICE_CATEGORY_LABEL);

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((category) => {
        const Icon = SERVICE_CATEGORY_ICON[category];
        const selected = value === category;
        return (
          <button
            key={category}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(category)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              selected
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-card text-muted hover:border-accent/40 hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label(category)}
          </button>
        );
      })}
    </div>
  );
}
