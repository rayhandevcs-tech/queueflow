"use client";

import { ShopDetailView } from "@/features/customer-booking/components/ShopDetailView";
import { useShopDetail, useShopServices } from "@/features/customer-booking/hooks/use-shop-detail";
import { useLoyaltySettings } from "@/features/loyalty/hooks/use-loyalty";
import { ShopMembershipTab } from "@/features/membership/components/ShopMembershipTab";
import { usePublicTiers } from "@/features/membership/hooks/use-tiers";
import { membershipDict } from "@/features/membership/lib/i18n";
import { ShopReferralTab } from "@/features/referral/components/ShopReferralTab";
import { referralDict } from "@/features/referral/lib/i18n";
import { isReferralLive, referralReward } from "@/features/referral/lib/referral";
import { ShopRewardsTab } from "@/features/rewards/components/ShopRewardsTab";
import { usePublicRewards } from "@/features/rewards/hooks/use-rewards";
import { rewardsDict } from "@/features/rewards/lib/i18n";
import { useT } from "@/lib/i18n";

/**
 * Where the shop page meets the features it cannot import.
 *
 * They meet here, in the app layer, because `eslint-plugin-boundaries` forbids
 * one feature importing another — the same reason the provider dashboard
 * composes `QueueBoard`'s break and voice slots instead of `provider-queue`
 * importing `provider-catalog`. Membership and referral are passed down as
 * slots.
 *
 * All three queries live here too, so each tab is only offered by a shop that
 * actually runs that programme (decision 36). A shop with none of them renders
 * exactly the page it rendered before — same tabs, same order.
 *
 * Referral reads loyalty's settings row rather than a table of its own,
 * because a referral reward *is* a loyalty point. A customer can read that
 * row at a shop with loyalty switched on, and when loyalty is off the row is
 * unreadable — which reads as null, which reads as "not live". That is the
 * correct answer arrived at by the same path the database uses.
 */
export function ShopDetailWithExtras({ shopId }: { shopId: string }) {
  const tm = useT(membershipDict);
  const tr = useT(referralDict);
  const tw = useT(rewardsDict);

  const { data: tiers } = usePublicTiers(shopId);
  const { data: loyaltySettings } = useLoyaltySettings(shopId);
  const { data: shop } = useShopDetail(shopId);
  const { data: rewards } = usePublicRewards(shopId);
  // The shelf needs service names to say what a FREE_SERVICE reward gives
  // away; the shop page already holds them for its own services tab.
  const { data: services } = useShopServices(shopId);

  const referralOn = isReferralLive(loyaltySettings);
  const reward = referralReward(loyaltySettings);
  // Live but paying nobody anything is not a programme worth a tab.
  const showReferral = referralOn && (reward.referrer > 0 || reward.referred > 0);

  return (
    <ShopDetailView
      shopId={shopId}
      membershipTab={
        (tiers?.length ?? 0) > 0
          ? { label: tm("shopTabLabel"), content: <ShopMembershipTab shopId={shopId} /> }
          : null
      }
      rewardsTab={
        (rewards?.length ?? 0) > 0
          ? {
              label: tw("shopTabLabel"),
              content: <ShopRewardsTab shopId={shopId} services={services} />,
            }
          : null
      }
      referralTab={
        showReferral
          ? {
              label: tr("shopTabLabel"),
              content: (
                <ShopReferralTab
                  shopId={shopId}
                  shopName={shop?.name ?? ""}
                  referrerPoints={reward.referrer}
                  referredPoints={reward.referred}
                />
              ),
            }
          : null
      }
    />
  );
}
