"use client";

import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

/**
 * Business type is deliberately absent: it decides which product a shop runs,
 * not something a customer browsing nearby shops wants to slice by. It stays
 * on the shop record and in the card's subtitle.
 */
export interface ShopFilters {
  minRating: number;
  maxDistanceKm: number | null;
  /**
   * Women-only shops. Not the same axis as business type at all: this is about
   * who may walk in, which is the one thing a customer has to know before
   * setting out, and a salon can be women-only too.
   */
  womenOnly: boolean;
}

export const DEFAULT_FILTERS: ShopFilters = {
  minRating: 0,
  maxDistanceKm: null,
  womenOnly: false,
};

export function hasActiveFilters(filters: ShopFilters): boolean {
  return filters.minRating > 0 || filters.maxDistanceKm != null || filters.womenOnly;
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

  // Reset the draft to the latest applied filters whenever the sheet opens —
  // adjusted during render (not an effect) per React's recommended pattern.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial);
  }

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

      <button
        type="button"
        onClick={() => setDraft((d) => ({ ...d, womenOnly: !d.womenOnly }))}
        aria-pressed={draft.womenOnly}
        className={cn(
          "flex min-h-11 w-full items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition-colors",
          draft.womenOnly ? "border-accent bg-accent/8" : "border-line bg-soft",
        )}
      >
        <ShieldCheck
          className={cn("h-4.5 w-4.5 shrink-0", draft.womenOnly ? "text-accent" : "text-muted")}
        />
        <span className="flex-1 text-sm font-semibold text-ink">{t("womenOnlyFilter")}</span>
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
            draft.womenOnly ? "border-accent bg-accent text-accent-ink" : "border-line bg-card",
          )}
        >
          {draft.womenOnly && <Check className="h-3 w-3" />}
        </span>
      </button>

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
