"use client";

import { BadgeCheck, Coins, LayoutGrid, Users } from "lucide-react";
import { StatTile } from "@/components/ui/StatTile";
import { formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import { AnalyticsSection, NumberText, PercentText, StatGrid } from "./AnalyticsSection";
import { shareOf, summarizeRetention } from "../lib/compute-dashboard";
import type { OverviewStats } from "../api/shop-analytics.api";

/**
 * The headline numbers, and the retention numbers that come out of the same
 * row.
 *
 * Revenue is Sprint 5.1's definition and nothing else: DONE serials + DONE
 * appointments + manual entries, PAID or DUE, dated by completion. The income
 * page reads the same three sources the same way, so the two screens cannot
 * disagree — and because `total_amount` is what Sprint 9's discount trigger
 * rewrites, a coupon-discounted bill is already counted at the amount the
 * customer actually paid.
 *
 * Nothing here is profit. Expenses are recorded by hand and nobody is obliged
 * to record them all, so a "profit" tile would be a confident number resting
 * on whatever the owner remembered to type. The income page shows expenses
 * where they belong; this page does not turn them into a margin.
 */
export function OverviewSection({
  data,
  isPending,
  isError,
  onRetry,
}: {
  data: OverviewStats | null | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useT(providerAnalyticsDict);
  const retention = summarizeRetention(data);
  const money = (n: number) => `৳${formatMoney(Math.round(n))}`;

  return (
    <>
      <AnalyticsSection
        title={t("sectionOverview")}
        icon={<LayoutGrid className="h-4.5 w-4.5" />}
        note={t("revenueNote")}
        isPending={isPending}
        isError={isError}
        onRetry={onRetry}
        isEmpty={!!data && data.jobs_completed === 0 && data.revenue_total === 0}
      >
        {data && (
          <div className="space-y-3">
            <StatGrid>
              <StatTile
                value={money(data.revenue_total)}
                label={t("tileRevenue")}
                tone="accent"
                icon={<Coins className="h-4 w-4" />}
              />
              <StatTile
                value={money(data.revenue_collected)}
                label={t("tileCollected")}
                accentValue="good"
                hint={
                  <>
                    <PercentText value={shareOf(data.revenue_collected, data.revenue_total)} />
                  </>
                }
              />
              <StatTile
                value={money(data.revenue_due)}
                label={t("tileDue")}
                accentValue={data.revenue_due > 0 ? "live" : "ink"}
              />
              <StatTile
                value={
                  data.avg_ticket === null ? (
                    <NumberText value={null} />
                  ) : (
                    money(data.avg_ticket)
                  )
                }
                label={t("tileAvgTicket")}
              />
            </StatGrid>

            <StatGrid>
              <StatTile
                value={toBanglaDigits(data.jobs_completed)}
                label={t("tileJobs")}
                icon={<BadgeCheck className="h-4 w-4" />}
              />
              <StatTile
                value={toBanglaDigits(data.customers_unique)}
                label={t("tileCustomers")}
                icon={<Users className="h-4 w-4" />}
              />
              <StatTile
                value={toBanglaDigits(data.walk_ins)}
                label={t("tileWalkIns")}
              />
              <StatTile
                value={toBanglaDigits(
                  data.serials_cancelled +
                    data.serials_no_show +
                    data.appointments_cancelled +
                    data.appointments_no_show,
                )}
                label={t("staffMissed")}
                accentValue="brass"
              />
            </StatGrid>
          </div>
        )}
      </AnalyticsSection>

      <AnalyticsSection
        title={t("sectionRetention")}
        icon={<Users className="h-4.5 w-4.5" />}
        note={t("retentionNote")}
        isPending={isPending}
        isError={isError}
        onRetry={onRetry}
        isEmpty={!!retention && retention.unique === 0}
      >
        {retention && (
          <StatGrid columns={3}>
            <StatTile
              value={toBanglaDigits(retention.newCount)}
              label={t("tileNew")}
              accentValue="accent"
              hint={
                <>
                  <PercentText value={retention.newRate} />
                </>
              }
            />
            <StatTile
              value={toBanglaDigits(retention.returningCount)}
              label={t("tileReturning")}
              accentValue="good"
              hint={
                <>
                  <PercentText value={retention.returningRate} />
                </>
              }
            />
            <StatTile
              value={toBanglaDigits(retention.repeatCount)}
              label={t("tileRepeat")}
              hint={
                <>
                  <PercentText value={retention.repeatRate} />
                </>
              }
            />
          </StatGrid>
        )}
      </AnalyticsSection>
    </>
  );
}
