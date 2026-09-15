"use client";

import { CalendarCheck, ListOrdered } from "lucide-react";
import { StatTile } from "@/components/ui/StatTile";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import { AnalyticsSection, NumberText, PercentText, StatGrid } from "./AnalyticsSection";
import { parseYmd } from "../lib/date-range";
import type { AppointmentStats, QueueStats } from "../api/shop-analytics.api";

/**
 * Two booking engines, two sections, and **never one pretending to be the
 * other**.
 *
 * A salon's serials have no scheduled slot, so they have no lead time and no
 * "booked length" — the customer walked in. A parlour's appointments have no
 * queue position, so they have no wait-in-line. Showing a parlour a
 * "queue wait" of 0 minutes, or a salon an "appointment no-show rate" of N/A,
 * would be a metric that exists only because the table it came from does.
 *
 * Which section shows is decided by `bookingModel()` — the one place in the
 * app where `business_type` turns into behaviour — plus one honest exception:
 * if the *other* engine has real rows in this window (a unisex shop running
 * both), its section appears too. A shop is never shown a section it cannot
 * use, and never denied one it is actually using.
 */
export function AppointmentSection({
  data,
  isPending,
  isError,
  onRetry,
  applicable,
}: {
  data: AppointmentStats | null | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  applicable: boolean;
}) {
  const t = useT(providerAnalyticsDict);

  return (
    <AnalyticsSection
      title={t("sectionAppointments")}
      icon={<CalendarCheck className="h-4.5 w-4.5" />}
      note={t("apRateNote")}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      unavailableText={applicable ? undefined : t("apNotUsed")}
      isEmpty={!!data && data.total === 0}
    >
      {data && (
        <div className="space-y-3">
          <StatGrid>
            <StatTile value={toBanglaDigits(data.total)} label={t("apTotal")} />
            <StatTile
              value={toBanglaDigits(data.completed)}
              label={t("apCompleted")}
              accentValue="good"
            />
            <StatTile
              value={toBanglaDigits(data.cancelled)}
              label={t("apCancelled")}
              accentValue={data.cancelled > 0 ? "brass" : "ink"}
            />
            <StatTile
              value={toBanglaDigits(data.no_show)}
              label={t("apNoShow")}
              accentValue={data.no_show > 0 ? "live" : "ink"}
            />
          </StatGrid>

          <StatGrid>
            <StatTile
              value={<PercentText value={data.completion_rate} />}
              label={t("apCompletionRate")}
            />
            <StatTile
              value={<PercentText value={data.no_show_rate} />}
              label={t("apNoShowRate")}
            />
            <StatTile value={<PercentText value={data.cancel_rate} />} label={t("apCancelRate")} />
            <StatTile
              value={toBanglaDigits(data.booked + data.confirmed + data.in_progress)}
              label={t("apUpcoming")}
            />
          </StatGrid>

          <StatGrid columns={2}>
            <StatTile
              value={<NumberText value={data.avg_scheduled_min} suffix={t("minShort")} />}
              label={t("apAvgMinutes")}
            />
            <StatTile
              value={<NumberText value={data.avg_lead_days} suffix={t("daysShort")} />}
              label={t("apLeadDays")}
            />
          </StatGrid>
        </div>
      )}
    </AnalyticsSection>
  );
}

export function QueueSection({
  data,
  isPending,
  isError,
  onRetry,
  applicable,
}: {
  data: QueueStats | null | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  applicable: boolean;
}) {
  const t = useT(providerAnalyticsDict);
  const busiest = data?.busiest_day ? parseYmd(data.busiest_day) : null;

  return (
    <AnalyticsSection
      title={t("sectionQueue")}
      icon={<ListOrdered className="h-4.5 w-4.5" />}
      note={t("qWaitNote")}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      unavailableText={applicable ? undefined : t("qNotUsed")}
      isEmpty={!!data && data.total === 0}
    >
      {data && (
        <div className="space-y-3">
          <StatGrid>
            <StatTile value={toBanglaDigits(data.total)} label={t("qTotal")} />
            <StatTile
              value={toBanglaDigits(data.completed)}
              label={t("qCompleted")}
              accentValue="good"
            />
            <StatTile
              value={toBanglaDigits(data.cancelled)}
              label={t("apCancelled")}
              accentValue={data.cancelled > 0 ? "brass" : "ink"}
            />
            <StatTile
              value={toBanglaDigits(data.no_show)}
              label={t("apNoShow")}
              accentValue={data.no_show > 0 ? "live" : "ink"}
            />
          </StatGrid>

          <StatGrid>
            <StatTile
              value={<PercentText value={data.completion_rate} />}
              label={t("apCompletionRate")}
            />
            <StatTile
              value={<NumberText value={data.avg_service_min} suffix={t("minShort")} />}
              label={t("qAvgService")}
            />
            <StatTile
              value={<NumberText value={data.avg_wait_min} suffix={t("minShort")} />}
              label={t("qAvgWait")}
            />
            <StatTile
              value={busiest ? formatBanglaDate(busiest) : <NumberText value={null} />}
              label={t("qBusiestDay")}
              hint={
                data.busiest_day_jobs > 0
                  ? `${toBanglaDigits(data.busiest_day_jobs)} ${t("staffJobs")}`
                  : undefined
              }
              size="sm"
            />
          </StatGrid>
        </div>
      )}
    </AnalyticsSection>
  );
}
