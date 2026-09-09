"use client";

import { Clock3 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useT } from "@/lib/i18n";
import { MAX_DURATION_MIN, formatDuration, joinDuration, splitDuration } from "@/lib/duration";
import { providerCatalogDict } from "../lib/i18n";

/** The lengths that cover most of a catalogue in one tap. */
const PRESETS_MIN = [15, 30, 45, 60, 90, 120, 180] as const;

/**
 * Service length, entered as hours and minutes.
 *
 * A single "minutes" box was fine while every service was a haircut. A bridal
 * package is 210 minutes, and nobody thinks in 210 minutes — so the input is
 * two boxes and the stored value stays one number (see `src/lib/duration.ts`;
 * the queue engine counts minutes and is not being asked to change).
 *
 * Uncontrolled-looking but fully derived: the two boxes are read straight off
 * `valueMin` every render, so there is no second copy of the truth to drift.
 */
export function DurationField({
  valueMin,
  onChange,
  invalid,
}: {
  valueMin: number;
  onChange: (minutes: number) => void;
  invalid?: boolean;
}) {
  const t = useT(providerCatalogDict);
  const { hours, minutes } = splitDuration(valueMin);

  const set = (next: { hours?: number; minutes?: number }) =>
    onChange(joinDuration({ hours: next.hours ?? hours, minutes: next.minutes ?? minutes }));

  // An empty box reads as zero while typing rather than NaN, so clearing the
  // hours field to type a new number doesn't blank the whole value.
  const num = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-muted">{t("durationLabel")}</span>

      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-1.5">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={Math.floor(MAX_DURATION_MIN / 60)}
            value={String(hours)}
            onChange={(e) => set({ hours: num(e.target.value) })}
            invalid={invalid}
            aria-label={t("durationHoursAria")}
          />
          <span className="shrink-0 text-[12px] text-muted">{t("durationHours")}</span>
        </label>
        <label className="flex flex-1 items-center gap-1.5">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={String(minutes)}
            onChange={(e) => set({ minutes: num(e.target.value) })}
            invalid={invalid}
            aria-label={t("durationMinutesAria")}
          />
          <span className="shrink-0 text-[12px] text-muted">{t("durationMinutes")}</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS_MIN.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            aria-pressed={valueMin === preset}
            className={
              valueMin === preset
                ? "rounded-full border border-accent bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-ink"
                : "rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-semibold text-muted hover:border-accent/40 hover:text-ink"
            }
          >
            {formatDuration(preset)}
          </button>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <Clock3 className="h-3.5 w-3.5 shrink-0" />
        {t("durationSummary", formatDuration(valueMin))}
      </p>
    </div>
  );
}
