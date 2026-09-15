"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Crown, Gift, Scissors, Sparkles } from "lucide-react";
import type { Shop } from "@/types";
import { Card } from "@/components/ui/Card";
import { bookingModel } from "@/lib/business-model";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import {
  useAppointmentStats,
  useBreakdown,
  useLoyaltyStats,
  useMembershipStats,
  useOverviewStats,
  usePeakSlots,
  useQueueStats,
  useReferralStats,
  useRevenueTrend,
  useRewardStats,
  useStaffStats,
} from "../hooks/use-shop-analytics";
import { presetRange, trendBucket, type DateRange } from "../lib/date-range";
import { AnalyticsSection } from "./AnalyticsSection";
import { AppointmentSection, QueueSection } from "./BookingSection";
import { BreakdownSection } from "./BreakdownSection";
import { OverviewSection } from "./OverviewSection";
import { PeakSection } from "./PeakSection";
import {
  LoyaltySection,
  MembershipSection,
  ReferralSection,
  RewardSection,
} from "./ProgrammeSections";
import { RangePicker } from "./RangePicker";
import { StaffSection } from "./StaffSection";
import { TrendSection } from "./TrendSection";

/**
 * The owner's business dashboard.
 *
 * Order is deliberate. Money and customers first, because that is what the
 * page is opened for; the booking engine the shop actually runs next; then
 * staff, then times, then the four loyalty-family programmes; and the
 * breakdowns last, collapsed, because they are a "why" the owner goes looking
 * for rather than something to meet on arrival. Nothing is hidden — every
 * heading is on the page and one tap opens it.
 *
 * Which booking sections appear is decided by `bookingModel()` plus real data:
 * a shop is shown the engine it runs, and also the other one if it genuinely
 * has rows in this window (unisex shops run both). That keeps a parlour from
 * ever seeing a "queue wait" and a salon from seeing an "appointment no-show
 * rate", while never hiding work a shop actually did.
 *
 * One clock reading per mount, held in state. `new Date()` during render is
 * impure and the React Compiler's lint says so — and it would also mean the
 * date range could silently shift under the owner at midnight while they read.
 */
export function AnalyticsDashboard({
  shop,
  /** The existing hourly/weekly queue-rhythm card, passed in by the page. */
  rhythmSlot,
  aiHref = "/ai",
}: {
  shop: Shop;
  rhythmSlot?: React.ReactNode;
  aiHref?: string;
}) {
  const t = useT(providerAnalyticsDict);
  const [today] = useState(() => new Date());
  // Seeded from that same reading, so the chip that lights up on first paint
  // is the one whose range was actually requested.
  const [range, setRange] = useState<DateRange>(() => presetRange("LAST_30", today));

  const shopId = shop.id;
  const overview = useOverviewStats(shopId, range);
  const trend = useRevenueTrend(shopId, range);
  const appointments = useAppointmentStats(shopId, range);
  const queue = useQueueStats(shopId, range);
  const staff = useStaffStats(shopId, range);
  const peak = usePeakSlots(shopId, range);
  const loyalty = useLoyaltyStats(shopId, range);
  const membership = useMembershipStats(shopId, range);
  const referral = useReferralStats(shopId, range);
  const rewards = useRewardStats(shopId, range);
  const services = useBreakdown(shopId, range, "SERVICE");
  const payments = useBreakdown(shopId, range, "PAYMENT_METHOD");
  const tiers = useBreakdown(shopId, range, "MEMBERSHIP_TIER");
  const popularRewards = useBreakdown(shopId, range, "REWARD");

  const model = bookingModel(shop.business_type);
  const hasAppointments = (appointments.data?.total ?? 0) > 0;
  const hasSerials = (queue.data?.total ?? 0) > 0;
  const showAppointments = model === "APPOINTMENT" || hasAppointments;
  const showQueue = model === "QUEUE" || hasSerials;

  const customersServed = overview.data?.customers_unique ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("dashTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">{t("dashSubtitle")}</p>
      </div>

      {/* 1. date range */}
      <RangePicker range={range} onChange={setRange} today={today} />

      {/* 2. overview + 3. retention */}
      <OverviewSection
        data={overview.data}
        isPending={overview.isPending}
        isError={overview.isError}
        onRetry={() => void overview.refetch()}
      />

      {/* 4. revenue trend */}
      <TrendSection
        data={trend.data}
        bucket={trendBucket(range)}
        isPending={trend.isPending}
        isError={trend.isError}
        onRetry={() => void trend.refetch()}
      />

      {/* 5. booking/service performance, per engine */}
      {showAppointments && (
        <AppointmentSection
          data={appointments.data}
          isPending={appointments.isPending}
          isError={appointments.isError}
          onRetry={() => void appointments.refetch()}
          applicable
        />
      )}
      {showQueue && (
        <QueueSection
          data={queue.data}
          isPending={queue.isPending}
          isError={queue.isError}
          onRetry={() => void queue.refetch()}
          applicable
        />
      )}
      {/* Neither engine has anything to report: say which one this shop uses
          rather than leaving a hole where a section should be. */}
      {!showAppointments && !showQueue && (
        <AppointmentSection
          data={null}
          isPending={false}
          isError={false}
          onRetry={() => void appointments.refetch()}
          applicable={false}
        />
      )}

      {/* 6. staff */}
      <StaffSection
        data={staff.data}
        isPending={staff.isPending}
        isError={staff.isError}
        onRetry={() => void staff.refetch()}
      />

      {/* 7. peak slots */}
      <PeakSection
        data={peak.data}
        isPending={peak.isPending}
        isError={peak.isError}
        onRetry={() => void peak.refetch()}
        showQueue={showQueue}
        showAppointments={showAppointments}
      />

      {/* The existing queue-rhythm card (hourly/weekly over 90 days). Passed in
          as a slot by the page: it is a different question — "what does a
          normal week look like" rather than "what happened in this period" —
          and it deliberately keeps its own fixed window. */}
      {rhythmSlot}

      {/* 8–11. the loyalty-family programmes */}
      <LoyaltySection
        data={loyalty.data}
        customersServed={customersServed}
        isPending={loyalty.isPending}
        isError={loyalty.isError}
        onRetry={() => void loyalty.refetch()}
      />
      <MembershipSection
        data={membership.data}
        customersServed={customersServed}
        isPending={membership.isPending}
        isError={membership.isError}
        onRetry={() => void membership.refetch()}
      />
      <ReferralSection
        data={referral.data}
        isPending={referral.isPending}
        isError={referral.isError}
        onRetry={() => void referral.refetch()}
      />
      <RewardSection
        data={rewards.data}
        isPending={rewards.isPending}
        isError={rewards.isError}
        onRetry={() => void rewards.refetch()}
      />

      {/* the breakdowns — collapsed by default */}
      <BreakdownSection
        title={t("sectionServices")}
        icon={<Scissors className="h-4.5 w-4.5" />}
        note={t("serviceSplitNote")}
        data={services.data}
        isPending={services.isPending}
        isError={services.isError}
        onRetry={() => void services.refetch()}
      />
      <BreakdownSection
        title={t("sectionPayments")}
        icon={<CreditCard className="h-4.5 w-4.5" />}
        data={payments.data}
        isPending={payments.isPending}
        isError={payments.isError}
        onRetry={() => void payments.refetch()}
        labelFor={(row) =>
          row.key === "due"
            ? t("paymentDue")
            : row.key === "unknown" || !row.label
              ? t("paymentUnknown")
              : row.label
        }
      />
      <BreakdownSection
        title={t("sectionTiers")}
        icon={<Crown className="h-4.5 w-4.5" />}
        data={tiers.data}
        isPending={tiers.isPending}
        isError={tiers.isError}
        onRetry={() => void tiers.refetch()}
      />
      <BreakdownSection
        title={t("sectionPopularRewards")}
        icon={<Gift className="h-4.5 w-4.5" />}
        data={popularRewards.data}
        isPending={popularRewards.isPending}
        isError={popularRewards.isError}
        onRetry={() => void popularRewards.refetch()}
      />

      {/* 12. the AI brief, which now reads these same aggregates */}
      <AnalyticsSection title={t("sectionAi")} icon={<Sparkles className="h-4.5 w-4.5" />}>
        <Card tone="soft" className="space-y-2.5 p-4">
          <p className="text-[12px] leading-relaxed text-muted">{t("aiBody")}</p>
          <Link href={aiHref} className="inline-block text-[13px] font-semibold text-accent hover:underline">
            {t("aiCta")}
          </Link>
        </Card>
      </AnalyticsSection>
    </div>
  );
}
