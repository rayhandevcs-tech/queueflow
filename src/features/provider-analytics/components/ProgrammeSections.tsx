"use client";

import { Coins, Crown, Gift, Share2 } from "lucide-react";
import { StatTile } from "@/components/ui/StatTile";
import { formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import { AnalyticsSection, NumberText, PercentText, StatGrid } from "./AnalyticsSection";
import { participationRate } from "../lib/compute-dashboard";
import type {
  LoyaltyStats,
  MembershipStats,
  ReferralStats,
  RewardStats,
} from "../api/shop-analytics.api";

/**
 * The four loyalty-family programmes, each reported from its own authoritative
 * source and nothing else.
 *
 * · **Loyalty** — the Sprint 7 ledger. Not one point is recomputed from a
 *   bill: `outstanding` is today's balance (which is the ledger's own sum, an
 *   invariant the harness checks), while earned/spent are flows inside the
 *   window. Two different kinds of fact, so two different tiles, never added
 *   together.
 * · **Membership** — Sprint 6's rows. Collected money only. No monthly
 *   recurring revenue, because there is no recurring billing: a renewal is a
 *   new row somebody sold by hand.
 * · **Referral** — Sprint 8's definition of a conversion. A claimed code is
 *   not a conversion; a finished job by the new customer is.
 * · **Rewards** — Sprint 9's redemptions. No refund figures, because there is
 *   no refund flow to measure.
 *
 * A programme that is switched off says so instead of showing zeros: "0 points
 * earned" reads as a failing programme, and the truth is there is no
 * programme.
 */

export function LoyaltySection({
  data,
  customersServed,
  isPending,
  isError,
  onRetry,
}: {
  data: LoyaltyStats | null | undefined;
  customersServed: number | null | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useT(providerAnalyticsDict);

  return (
    <AnalyticsSection
      title={t("sectionLoyalty")}
      icon={<Coins className="h-4.5 w-4.5" />}
      note={t("loyNote")}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      unavailableText={data && !data.is_enabled ? t("loyOff") : undefined}
    >
      {data && (
        <div className="space-y-3">
          <StatGrid>
            <StatTile
              value={toBanglaDigits(data.accounts)}
              label={t("loyAccounts")}
              hint={
                <>
                  <PercentText value={participationRate(data.accounts, customersServed)} />{" "}
                  {t("tileCustomers")}
                </>
              }
            />
            <StatTile
              value={toBanglaDigits(data.accounts_with_balance)}
              label={t("loyWithBalance")}
            />
            <StatTile
              value={toBanglaDigits(data.outstanding_points)}
              label={t("loyOutstanding")}
              accentValue="brass"
            />
            <StatTile
              value={toBanglaDigits(data.transactions)}
              label={t("loyTransactions")}
            />
          </StatGrid>
          <StatGrid>
            <StatTile
              value={toBanglaDigits(data.earned_points)}
              label={t("loyEarned")}
              accentValue="good"
            />
            <StatTile
              value={toBanglaDigits(data.redeemed_points)}
              label={t("loyRedeemed")}
              accentValue="accent"
            />
            <StatTile
              value={toBanglaDigits(data.adjusted_points)}
              label={t("loyAdjusted")}
            />
            <StatTile
              value={toBanglaDigits(data.referral_points)}
              label={t("loyReferralPoints")}
            />
          </StatGrid>
        </div>
      )}
    </AnalyticsSection>
  );
}

export function MembershipSection({
  data,
  customersServed,
  isPending,
  isError,
  onRetry,
}: {
  data: MembershipStats | null | undefined;
  customersServed: number | null | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useT(providerAnalyticsDict);
  const money = (n: number) => `৳${formatMoney(Math.round(n))}`;

  return (
    <AnalyticsSection
      title={t("sectionMembership")}
      icon={<Crown className="h-4.5 w-4.5" />}
      note={t("memNote")}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!!data && data.tiers_total === 0}
    >
      {data && (
        <div className="space-y-3">
          <StatGrid>
            <StatTile
              value={toBanglaDigits(data.active_members)}
              label={t("memActive")}
              accentValue="good"
              hint={
                <>
                  <PercentText value={participationRate(data.active_members, customersServed)} />{" "}
                  {t("tileCustomers")}
                </>
              }
            />
            <StatTile value={toBanglaDigits(data.pending_members)} label={t("memPending")} />
            <StatTile
              value={toBanglaDigits(data.expiring_soon)}
              label={t("memExpiringSoon")}
              accentValue={data.expiring_soon > 0 ? "brass" : "ink"}
            />
            <StatTile value={toBanglaDigits(data.new_in_range)} label={t("memNew")} />
          </StatGrid>
          <StatGrid>
            <StatTile value={money(data.revenue_collected)} label={t("memRevenue")} />
            <StatTile
              value={money(data.revenue_due)}
              label={t("memDue")}
              accentValue={data.revenue_due > 0 ? "live" : "ink"}
            />
            <StatTile value={toBanglaDigits(data.expired_members)} label={t("memExpired")} />
            <StatTile
              value={`${toBanglaDigits(data.tiers_active)}/${toBanglaDigits(data.tiers_total)}`}
              label={t("memTiers")}
            />
          </StatGrid>
        </div>
      )}
    </AnalyticsSection>
  );
}

export function ReferralSection({
  data,
  isPending,
  isError,
  onRetry,
}: {
  data: ReferralStats | null | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useT(providerAnalyticsDict);

  return (
    <AnalyticsSection
      title={t("sectionReferral")}
      icon={<Share2 className="h-4.5 w-4.5" />}
      note={t("refNote")}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      unavailableText={data && !data.is_enabled ? t("refOff") : undefined}
      isEmpty={!!data && data.codes_issued === 0 && data.referrals_total === 0}
    >
      {data && (
        <div className="space-y-3">
          <StatGrid>
            <StatTile value={toBanglaDigits(data.referrals_total)} label={t("refTotal")} />
            <StatTile
              value={toBanglaDigits(data.referrals_converted)}
              label={t("refConverted")}
              accentValue="good"
            />
            <StatTile value={toBanglaDigits(data.referrals_pending)} label={t("refPending")} />
            <StatTile value={<PercentText value={data.conversion_rate} />} label={t("refRate")} />
          </StatGrid>
          <StatGrid columns={3}>
            <StatTile value={toBanglaDigits(data.codes_issued)} label={t("refCodes")} />
            <StatTile
              value={toBanglaDigits(data.customers_brought)}
              label={t("refBrought")}
              accentValue="accent"
            />
            <StatTile value={toBanglaDigits(data.points_awarded)} label={t("refPoints")} />
          </StatGrid>
        </div>
      )}
    </AnalyticsSection>
  );
}

export function RewardSection({
  data,
  isPending,
  isError,
  onRetry,
}: {
  data: RewardStats | null | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useT(providerAnalyticsDict);
  const money = (n: number) => `৳${formatMoney(Math.round(n))}`;

  return (
    <AnalyticsSection
      title={t("sectionRewards")}
      icon={<Gift className="h-4.5 w-4.5" />}
      note={t("rwNote")}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!!data && data.rewards_total === 0}
    >
      {data && (
        <div className="space-y-3">
          <StatGrid>
            <StatTile
              value={`${toBanglaDigits(data.rewards_active)}/${toBanglaDigits(data.rewards_total)}`}
              label={t("rwActive")}
            />
            <StatTile value={toBanglaDigits(data.rewards_available)} label={t("rwAvailable")} />
            <StatTile value={toBanglaDigits(data.redemptions_issued)} label={t("rwIssued")} />
            <StatTile
              value={toBanglaDigits(data.redemptions_used)}
              label={t("rwUsed")}
              accentValue="good"
            />
          </StatGrid>
          <StatGrid>
            <StatTile value={<PercentText value={data.use_rate} />} label={t("rwUseRate")} />
            <StatTile
              value={toBanglaDigits(data.redemptions_expired)}
              label={t("rwExpired")}
              accentValue={data.redemptions_expired > 0 ? "brass" : "ink"}
            />
            <StatTile value={toBanglaDigits(data.points_spent)} label={t("rwPoints")} />
            <StatTile value={money(data.discount_given)} label={t("rwDiscount")} />
          </StatGrid>
          <p className="text-[11px] text-muted">
            {t("rwCustomers")}:{" "}
            <b className="font-number text-ink">
              <NumberText value={data.redeeming_customers} />
            </b>
          </p>
        </div>
      )}
    </AnalyticsSection>
  );
}
