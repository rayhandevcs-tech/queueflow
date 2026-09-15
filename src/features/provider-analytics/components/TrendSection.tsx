"use client";

import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import { AnalyticsSection } from "./AnalyticsSection";
import { summarizeTrend, type TrendPoint } from "../lib/compute-dashboard";
import { parseYmd } from "../lib/date-range";

/**
 * Revenue over time, as bars.
 *
 * Bars rather than a line, and hand-drawn with `div`s rather than a charting
 * library, for the same reason the existing hourly chart on this page is: the
 * stack is fixed and heavy dependencies are avoided by decision, and a bar
 * chart is a flexbox row with heights on it.
 *
 * The **empty buckets are drawn**. `shop_revenue_trend` returns every day in
 * the window, quiet ones included, so a week with two busy days reads as two
 * busy days and five quiet ones instead of two bars side by side pretending to
 * be consecutive.
 *
 * It scrolls horizontally when there are more bars than fit — that is the one
 * exception the responsive rule allows, because the alternative is dropping
 * days, and a chart with days missing is worse than a chart you swipe.
 */
export function TrendSection({
  data,
  bucket,
  isPending,
  isError,
  onRetry,
}: {
  data: TrendPoint[] | undefined;
  bucket: "DAY" | "MONTH";
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useT(providerAnalyticsDict);
  const points = data ?? [];
  const summary = summarizeTrend(points);
  const money = (n: number) => formatMoney(Math.round(n));
  // Its own scale: bookings and taka share an axis in no useful way.
  const jobScale = Math.max(1, ...points.map((p) => p.jobs));

  const label = (iso: string) => {
    const date = parseYmd(iso);
    if (!date) return iso;
    return bucket === "MONTH"
      ? `${toBanglaDigits(date.getMonth() + 1)}/${toBanglaDigits(date.getFullYear() % 100)}`
      : formatBanglaDate(date);
  };

  return (
    <AnalyticsSection
      title={t("sectionTrend")}
      subtitle={bucket === "MONTH" ? t("trendMonthly") : t("trendDaily")}
      icon={<TrendingUp className="h-4.5 w-4.5" />}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      isEmpty={points.length > 0 && summary.revenueTotal === 0}
    >
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[13px] font-semibold text-ink">
            {summary.best
              ? t("trendBest", label(summary.best.bucket_start), money(summary.best.revenue_total))
              : t("emptyRange")}
          </p>
          <p className="text-[12px] text-muted">
            {bucket === "MONTH" ? t("trendPerMonth") : t("trendPerDay")}:{" "}
            <b className="font-number text-ink">
              ৳{summary.perBucket === null ? "—" : money(summary.perBucket)}
            </b>
          </p>
        </div>

        {/* Money above, bookings below, one column per bucket and one scroll
            container for both — so the two series stay aligned and a busy day
            that earned little is visible as exactly that. */}
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div
            className="flex items-end gap-1.5"
            style={{ minWidth: `${Math.max(points.length * 26, 0)}px` }}
          >
            {points.map((point) => {
              const isBest = summary.best?.bucket_start === point.bucket_start;
              return (
                <div
                  key={point.bucket_start}
                  className="flex min-w-6 flex-1 flex-col items-center gap-1"
                  title={`${label(point.bucket_start)} · ৳${money(point.revenue_total)} · ${toBanglaDigits(point.jobs)}`}
                >
                  <div className="flex h-32 w-full items-end">
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${Math.max(2, (point.revenue_total / summary.scale) * 100)}%`,
                        background: isBest ? "var(--color-accent)" : "var(--color-brass-soft)",
                      }}
                    />
                  </div>
                  <div className="flex h-8 w-full items-start">
                    <div
                      className="w-full rounded-b-md bg-accent/30"
                      style={{ height: `${Math.max(2, (point.jobs / jobScale) * 100)}%` }}
                    />
                  </div>
                  <span className="max-w-full truncate text-[9px] leading-none text-muted">
                    {label(point.bucket_start)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-brass-soft align-middle" />
            {t("sectionTrend")}: <b className="font-number text-ink">৳{money(summary.revenueTotal)}</b>
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent/30 align-middle" />
            {t("tileJobs")}: <b className="font-number text-ink">{toBanglaDigits(summary.jobs)}</b>
          </span>
          <span>
            {t("tileCollected")}:{" "}
            <b className="font-number text-ink">৳{money(summary.revenueCollected)}</b>
          </span>
        </div>
      </Card>
    </AnalyticsSection>
  );
}
