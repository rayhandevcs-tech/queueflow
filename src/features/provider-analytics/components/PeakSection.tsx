"use client";

import { Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import { AnalyticsSection } from "./AnalyticsSection";
import {
  hourWindow,
  slotBars,
  slotTotal,
  type PeakSlot,
  type SlotBar,
} from "../lib/compute-dashboard";

/**
 * When the shop is actually busy — described, never predicted.
 *
 * Two sources kept apart because they mean different things: appointment
 * demand is counted at the **slot** (that is the hour customers asked for) and
 * queue load at **completion** (that is when the chair was occupied). Adding
 * them into one "busy" number would mix a wish with a fact.
 *
 * Only the source a shop actually uses is drawn — a parlour sees appointment
 * slots, a salon sees queue hours, and a shop running both sees both. Empty
 * sources are not drawn at all rather than shown as a flat row of zeros.
 */
export function PeakSection({
  data,
  isPending,
  isError,
  onRetry,
  showQueue,
  showAppointments,
}: {
  data: PeakSlot[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  showQueue: boolean;
  showAppointments: boolean;
}) {
  const t = useT(providerAnalyticsDict);
  const slots = data ?? [];

  const panels: Array<{ source: "SERIAL" | "APPOINTMENT"; title: string }> = [];
  if (showAppointments && slotTotal(slots, "HOUR", "APPOINTMENT") > 0) {
    panels.push({ source: "APPOINTMENT", title: t("peakAppointments") });
  }
  if (showQueue && slotTotal(slots, "HOUR", "SERIAL") > 0) {
    panels.push({ source: "SERIAL", title: t("peakQueue") });
  }

  return (
    <AnalyticsSection
      title={t("sectionPeak")}
      icon={<Clock className="h-4.5 w-4.5" />}
      note={t("peakNote")}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      isEmpty={panels.length === 0}
    >
      <div className="space-y-3">
        {panels.map((panel) => (
          <SourcePanel key={panel.source} slots={slots} source={panel.source} title={panel.title} />
        ))}
      </div>
    </AnalyticsSection>
  );
}

function SourcePanel({
  slots,
  source,
  title,
}: {
  slots: readonly PeakSlot[];
  source: "SERIAL" | "APPOINTMENT";
  title: string;
}) {
  const t = useT(providerAnalyticsDict);
  const hourBars = slotBars(slots, "HOUR", source);
  const window = hourWindow(hourBars);
  const hours = hourBars.filter((bar) => bar.bucket >= window.from && bar.bucket <= window.to);
  const weekBars = slotBars(slots, "WEEKDAY", source);
  const peakHour = hourBars.find((bar) => bar.isPeak) ?? null;
  const peakDay = weekBars.find((bar) => bar.isPeak) ?? null;

  const hourLabel = (hour: number) =>
    t("hourRange", toBanglaDigits(hour), toBanglaDigits((hour + 1) % 24));

  return (
    <Card className="space-y-3.5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        {peakHour && (
          <p className="text-[11px] text-muted">
            {t("peakBusiest", hourLabel(peakHour.bucket), toBanglaDigits(peakHour.jobs))}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold text-muted">{t("peakByHour")}</p>
        {/* Scrolls only when the working day is wider than the screen — the
            bars keep a 14px minimum rather than shrinking to a hairline. */}
        <div className="-mx-1 overflow-x-auto px-1">
          <Bars bars={hours} minWidth={14} label={(bar) => toBanglaDigits(bar.bucket)} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold text-muted">{t("peakByWeekday")}</p>
        <Bars bars={weekBars} minWidth={18} label={(bar) => t("weekdayIso", bar.bucket)} />
        {peakDay && peakDay.jobs > 0 && (
          <p className="mt-1.5 text-[11px] text-muted">
            {t("peakBusiest", t("weekdayIso", peakDay.bucket), toBanglaDigits(peakDay.jobs))}
          </p>
        )}
      </div>
    </Card>
  );
}

function Bars({
  bars,
  minWidth,
  label,
}: {
  bars: SlotBar[];
  minWidth: number;
  label: (bar: SlotBar) => string;
}) {
  const scale = Math.max(1, ...bars.map((bar) => bar.jobs));
  return (
    <div className="flex h-24 items-end gap-1">
      {bars.map((bar) => (
        <div
          key={bar.bucket}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          style={{ minWidth: `${minWidth}px` }}
          title={`${label(bar)} · ${toBanglaDigits(bar.jobs)}`}
        >
          <div
            className="w-full rounded-t-[5px]"
            style={{
              height: `${Math.max(2, (bar.jobs / scale) * 100)}%`,
              background: bar.isPeak
                ? "var(--color-live)"
                : bar.jobs > 0
                  ? `color-mix(in srgb, var(--color-accent) ${Math.round((bar.jobs / scale) * 70)}%, var(--color-soft))`
                  : "var(--color-soft)",
            }}
          />
          <span
            className={
              bar.isPeak
                ? "text-[9px] font-semibold text-ink"
                : "text-[9px] leading-none text-muted"
            }
          >
            {label(bar)}
          </span>
        </div>
      ))}
    </div>
  );
}
