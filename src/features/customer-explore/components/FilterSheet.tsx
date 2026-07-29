"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { BUSINESS_TYPES, type SelectableBusinessType } from "@/config/constants";

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

  // Reset the draft to the latest applied filters whenever the sheet opens —
  // adjusted during render (not an effect) per React's recommended pattern.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial);
  }

  if (!open) return null;

  const toggleType = (type: SelectableBusinessType) => {
    setDraft((d) => {
      const types = new Set(d.types);
      if (types.has(type)) types.delete(type);
      else types.add(type);
      return { ...d, types };
    });
  };

  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-ink/50 p-4 backdrop-blur-sm sm:place-items-center">
      <div className="w-full max-w-sm space-y-5 rounded-t-3xl bg-card p-5 pb-6 shadow-lg animate-slide-up sm:rounded-2xl sm:animate-none">
        <div className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden" />

        <h2 className="font-display text-lg font-bold text-ink">ফিল্টার</h2>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted">ধরন</p>
          <div className="flex gap-2">
            {BUSINESS_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleType(t.value)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                  draft.types.has(t.value)
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-soft text-ink",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted">রেটিং</p>
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
                {r === 0 ? "সব" : `${r}+ ★`}
              </button>
            ))}
          </div>
        </div>

        {hasLocation && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-muted">দূরত্ব</p>
              <span className="text-[13px] font-semibold text-ink">
                {draft.maxDistanceKm == null ? "সব" : `${draft.maxDistanceKm} কিমি-এর মধ্যে`}
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
            রিসেট
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            প্রয়োগ করো
          </Button>
        </div>
      </div>
    </div>
  );
}
