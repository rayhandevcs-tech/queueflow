"use client";

import { useMemo } from "react";
import { Coins, Share2, UserPlus, Users } from "lucide-react";
import type { LoyaltySettings, Shop } from "@/types";
import { StatTile } from "@/components/ui/StatTile";
import { toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useReferralSettingsActions, useShopReferralStats } from "../hooks/use-referral";
import { referralDict } from "../lib/i18n";
import { isReferralLive } from "../lib/referral";
import { ReferralSettingsCard } from "./ReferralSettingsCard";
import { ReferralStatsTable } from "./ReferralStatsTable";

/**
 * The owner's referral screen.
 *
 * One screen for both business types, for the third sprint in a row and the
 * same reason: a referral is a property of the business, not of how it takes
 * bookings. A salon qualifies one from a finished serial and a parlour from a
 * finished appointment, and the same trigger handles both.
 *
 * The loyalty settings come in as a prop rather than being fetched here. They
 * belong to the loyalty feature, and `eslint-plugin-boundaries` forbids one
 * feature reading another's hooks — so the app layer, which may read both,
 * hands them down. That is also the honest shape of the dependency: referral
 * has no settings table of its own.
 */
export function ReferralManagerView({
  shop,
  settings,
  loyaltyHref = "/loyalty",
}: {
  shop: Shop;
  settings: LoyaltySettings | null | undefined;
  loyaltyHref?: string;
}) {
  const t = useT(referralDict);
  const stats = useShopReferralStats(shop.id);
  const saveSettings = useReferralSettingsActions(shop.id);

  const totals = useMemo(() => {
    const rows = stats.data ?? [];
    return {
      referrers: rows.length,
      claimed: rows.reduce((sum, row) => sum + row.totalReferrals, 0),
      converted: rows.reduce((sum, row) => sum + row.convertedCount, 0),
      points: rows.reduce((sum, row) => sum + row.pointsAwarded, 0),
    };
  }, [stats.data]);

  const live = isReferralLive(settings);
  const num = (n: number) => toBanglaDigits(n);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("ownerTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">{t("ownerSubtitle")}</p>
      </div>

      <ReferralSettingsCard
        settings={settings}
        busy={saveSettings.isPending}
        onSubmit={(values) => saveSettings.mutate(values)}
        loyaltyHref={loyaltyHref}
      />

      {saveSettings.isError && (
        <p className="text-sm text-live">
          {saveSettings.error instanceof Error ? saveSettings.error.message : t("loadFailed")}
        </p>
      )}

      {/* The tiles only mean something once there is a programme. Four zeros
          above a switched-off switch would be noise. */}
      {live && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            value={num(totals.referrers)}
            label={t("tileReferrers")}
            icon={<Users className="h-4 w-4" />}
            accentValue={totals.referrers > 0 ? "good" : "ink"}
          />
          <StatTile
            value={num(totals.claimed)}
            label={t("tileClaimed")}
            icon={<Share2 className="h-4 w-4" />}
          />
          <StatTile
            value={num(totals.converted)}
            label={t("tileConverted")}
            icon={<UserPlus className="h-4 w-4" />}
            accentValue={totals.converted > 0 ? "accent" : "ink"}
          />
          <StatTile
            value={num(totals.points)}
            label={t("tilePoints")}
            icon={<Coins className="h-4 w-4" />}
          />
        </div>
      )}

      {/* The table stays visible even when the programme is paused: referrals
          already made still exist, and the owner still has to answer for the
          points they cost. Only new claims stop. */}
      {(live || (stats.data?.length ?? 0) > 0) && (
        <ReferralStatsTable
          rows={stats.data}
          isPending={stats.isPending}
          isError={stats.isError}
        />
      )}
    </div>
  );
}
