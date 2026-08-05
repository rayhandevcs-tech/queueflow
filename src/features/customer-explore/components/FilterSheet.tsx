"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { BUSINESS_TYPES, type SelectableBusinessType } from "@/config/constants";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

export interface ShopFilters {
  types: Set<SelectableBusinessType>;
  minRating: number;
  maxDistanceKm: number | null;
}

export const DEFAULT_FILTERS: ShopFilters = {
  types: new Set(),
  minRating: 0,
  maxDistanceKm: null,
};

export function hasActiveFilters(filters: ShopFilters): boolean {
  return filters.types.size > 0 || filters.minRating > 0 || filters.maxDistanceKm != null;
}

const RATING_OPTIONS = [0, 3, 4, 4.5];
const MAX_DISTANCE_KM = 20;

export function FilterSheet({
  open,
  initial,
  hasLocation,
  onApply,
  onClose,
}: {
  open: boolean;
  initial: ShopFilters;
  hasLocation: boolean;
  onApply: (filters: ShopFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [prevOpen, setPrevOpen] = useState(open);
  const t = useT(customerExploreDict);
  const businessTypeT = useT(
    Object.fromEntries(BUSINESS_TYPES.map((bt) => [bt.value, bt.label])) as Record<
      SelectableBusinessType,
      { bn: string; en: string }
    >,
  );

  // Reset the draft to the latest applied filters whenever the sheet opens —
  // adjusted during render (not an effect) per React's recommended pattern.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial);
  }

  const toggleType = (type: SelectableBusinessType) => {
    setDraft((d) => {
      const types = new Set(d.types);
      if (types.has(type)) types.delete(type);
      else types.add(type);
      return { ...d, types };
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxWidthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">{t("filterTitle")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("closeFilters")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-soft"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-muted">{t("typeLabel")}</p>
        <div className="flex gap-2">
          {BUSINESS_TYPES.map((bt) => (
            <button
              key={bt.value}
              type="button"
              onClick={() => toggleType(bt.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                draft.types.has(bt.value)
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-soft text-ink",
              )}
            >
              {businessTypeT(bt.value)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-muted">{t("ratingLabel")}</p>
        <div className="flex gap-2">
          {RATING_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, minRating: r }))}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                draft.minRating === r
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-soft text-ink",
              )}
            >
              {r === 0 ? t("all") : `${r}+ ★`}
            </button>
          ))}
        </div>
      </div>

      {hasLocation && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-muted">{t("distanceLabel")}</p>
            <span className="text-[13px] font-semibold text-ink">
              {draft.maxDistanceKm == null ? t("all") : t("withinKm", draft.maxDistanceKm)}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={MAX_DISTANCE_KM}
            step={1}
            value={draft.maxDistanceKm ?? MAX_DISTANCE_KM}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                maxDistanceKm:
                  Number(e.target.value) >= MAX_DISTANCE_KM ? null : Number(e.target.value),
              }))
            }
            className="w-full accent-(--color-accent)"
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setDraft(DEFAULT_FILTERS)}>
          {t("reset")}
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          {t("apply")}
        </Button>
      </div>
    </BottomSheet>
  );
}
