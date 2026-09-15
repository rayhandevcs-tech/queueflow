"use client";

import { Share2 } from "lucide-react";
import { useAuthGate } from "@/components/auth/AuthGate";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n";
import { referralDict } from "../lib/i18n";
import { ReferralClaimCard } from "./ReferralClaimCard";
import { MyReferralCard } from "./MyReferralCard";

/**
 * Referral, as a customer sees it on a shop's page.
 *
 * A tab on the existing shop page rather than a route of its own, for the
 * reason membership is: a referral code is a fact about *this shop*, and
 * every other fact about this shop is already a tab here.
 *
 * There is deliberately **no referral section on the profile page**. Loyalty
 * put point cards there because a balance is worth seeing without picking a
 * shop first; a code is not — it only means anything next to the shop it
 * belongs to, and a second copy of this card on the profile would be two
 * places to keep in step for no new information. Noted in the backlog rather
 * than built.
 *
 * The claim card comes first. Someone arriving with a friend's code is here
 * to use it, and burying that under their own share card would ask them to
 * scroll past the thing they came for.
 */
export function ShopReferralTab({
  shopId,
  shopName,
  referrerPoints,
  referredPoints,
}: {
  shopId: string;
  shopName: string;
  referrerPoints: number;
  referredPoints: number;
}) {
  const t = useT(referralDict);
  // Reading the tab needs no account; getting a code or claiming one does.
  // The app's existing action-based gate decides that, exactly as booking and
  // joining a membership do.
  const { signedIn, guard } = useAuthGate();
  const requireLogin = guard(() => {});

  if (referrerPoints === 0 && referredPoints === 0) {
    // Live, but paying nobody anything. The tab should not have been offered
    // at all in that state; showing why beats showing an empty card.
    return (
      <EmptyState
        icon={<Share2 className="h-6 w-6" />}
        title={t("programmeOff")}
        description={t("offNoticeBody")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ReferralClaimCard
        shopId={shopId}
        referredPoints={referredPoints}
        signedIn={signedIn}
        onRequireLogin={requireLogin}
      />
      <MyReferralCard
        shopId={shopId}
        shopName={shopName}
        referrerPoints={referrerPoints}
        referredPoints={referredPoints}
        signedIn={signedIn}
        onRequireLogin={requireLogin}
      />
    </div>
  );
}
