"use client";

import { CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import {
  includesFuture,
  parseYmd,
  presetFor,
  presetRange,
  rangeDays,
  rangeProblem,
  type DateRange,
  type RangePreset,
} from "../lib/date-range";

const PRESETS: readonly {
  value: Exclude<RangePreset, "CUSTOM">;
  // The dict key, typed as a union rather than `string`, so renaming an entry
  // in `i18n.ts` is a compile error here instead of a blank chip.
  key: "presetToday" | "preset7" | "preset30" | "presetMonth";
}[] = [
  { value: "TODAY", key: "presetToday" },
  { value: "LAST_7", key: "preset7" },
  { value: "LAST_30", key: "preset30" },
  { value: "THIS_MONTH", key: "presetMonth" },
] as const;

/**
 * The one control that decides what every number on the page means.
 *
 * Four presets and a custom pair, not a calendar widget: the presets are what
 * a shopkeeper actually asks for ("today", "this month"), and the two native
 * date inputs handle the rare custom case with the phone's own picker rather
 * than a hand-built one.
 *
 * A bad custom range is explained here and the queries simply do not fire —
 * `useQuery`'s `enabled` is false for a range the server would reject — so the
 * owner sees a sentence about their dates instead of eleven red error boxes
 * while they are still typing.
 *
 * It wraps rather than scrolls: at 320px the preset chips flow onto two rows
 * and the date fields stack, because a horizontally scrolling filter bar hides
 * options behind an edge nobody taps.
 */
export function RangePicker({
  range,
  onChange,
  today,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
  /** Injected so the page holds one clock reading per mount, not one per render. */
  today: Date;
}) {
  const t = useT(providerAnalyticsDict);
  const active = presetFor(range, today);
  const problem = rangeProblem(range);
  const days = rangeDays(range);
  const from = parseYmd(range.from);
  const to = parseYmd(range.to);

  return (
    <Card tone="soft" className="space-y-3 p-3.5">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 shrink-0 text-muted" />
        <p className="text-[12px] font-semibold text-muted">{t("rangeLabel")}</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("rangeLabel")}>
        {PRESETS.map((preset) => {
          const selected = active === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(presetRange(preset.value, today))}
              className={
                selected
                  ? "min-h-11 rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-ink"
                  : "min-h-11 rounded-full border border-line bg-card px-4 text-[13px] font-semibold text-muted hover:border-accent/40 hover:text-ink"
              }
            >
              {t(preset.key)}
            </button>
          );
        })}
        <span
          className={
            active === "CUSTOM"
              ? "grid min-h-11 place-items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-ink"
              : "grid min-h-11 place-items-center rounded-full border border-dashed border-line px-4 text-[13px] font-semibold text-muted"
          }
        >
          {t("presetCustom")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label={t("customFrom")}>
          <Input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(event) => onChange({ ...range, from: event.target.value })}
            invalid={problem === "REVERSED" || problem === "MALFORMED"}
          />
        </Field>
        <Field label={t("customTo")}>
          <Input
            type="date"
            value={range.to}
            onChange={(event) => onChange({ ...range, to: event.target.value })}
            invalid={problem === "MALFORMED"}
          />
        </Field>
      </div>

      {problem ? (
        <p className="text-[12px] font-medium text-live">
          {problem === "REVERSED"
            ? t("rangeReversed")
            : problem === "TOO_WIDE"
              ? t("rangeTooWide")
              : t("rangeMalformed")}
        </p>
      ) : (
        <p className="text-[12px] text-muted">
          {from && to && t("rangeShown", formatBanglaDate(from), formatBanglaDate(to))}
          {days !== null && ` · ${t("rangeDayCount", toBanglaDigits(days))}`}
        </p>
      )}

      {!problem && includesFuture(range, today) && (
        <p className="text-[12px] leading-snug text-brass">{t("rangeFuture")}</p>
      )}
    </Card>
  );
}
