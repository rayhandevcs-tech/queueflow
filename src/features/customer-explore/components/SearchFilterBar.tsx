"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

export function SearchFilterBar({
  value,
  onChange,
  onOpenFilters,
  filtersActive,
}: {
  value: string;
  onChange: (value: string) => void;
  onOpenFilters: () => void;
  filtersActive: boolean;
}) {
  const t = useT(customerExploreDict);

  return (
    <div className="mb-4 flex gap-2">
      <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2.5 shadow-xs">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={onOpenFilters}
        className={cn(
          "relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border shadow-xs transition-colors",
          filtersActive ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-ink",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {filtersActive && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-live" />
        )}
      </button>
    </div>
  );
}
