"use client";

import { cn } from "@/lib/utils";
import { SERVICE_CATEGORY_LABEL, type ServiceCategory } from "@/config/constants";
import { SERVICE_CATEGORY_ICON } from "@/lib/service-category-icon";
import { useT } from "@/lib/i18n";

export function CategoryShortcutRow({
  categories,
  active,
  onSelect,
}: {
  categories: Set<ServiceCategory>;
  active: ServiceCategory | null;
  onSelect: (category: ServiceCategory | null) => void;
}) {
  const categoryT = useT(SERVICE_CATEGORY_LABEL);

  // "অন্যান্য" on its own is not a shortcut — every shop lands in it, so
  // tapping it filters nothing out. The row only earns its space once there
  // is a real choice to make.
  const real = [...categories].filter((c) => c !== "OTHER");
  if (real.length === 0) return null;

  return (
    <div className="mb-5 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {real.map((category) => {
        const Icon = SERVICE_CATEGORY_ICON[category];
        const isActive = active === category;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(isActive ? null : category)}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <div
              className={cn(
                "grid h-13 w-13 place-items-center rounded-full border transition-colors",
                isActive
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-card text-ink",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className={cn("text-[11px]", isActive ? "font-semibold text-ink" : "text-muted")}>
              {categoryT(category)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
