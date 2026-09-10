"use client";

import { ShopDetailView } from "@/features/customer-booking/components/ShopDetailView";
import { ShopMembershipTab } from "@/features/membership/components/ShopMembershipTab";
import { usePublicTiers } from "@/features/membership/hooks/use-tiers";
import { membershipDict } from "@/features/membership/lib/i18n";
import { useT } from "@/lib/i18n";

/**
 * Where the shop page and the membership feature meet.
 *
 * They meet here, in the app layer, because `eslint-plugin-boundaries` forbids
 * one feature importing another — the same reason the provider dashboard
 * composes `QueueBoard`'s break and voice slots instead of `provider-queue`
 * importing `provider-catalog`. The membership tab is passed down as a slot.
 *
 * The tier query lives here too, so the tab is only offered by a shop that
 * actually sells memberships (decision 36). A shop with no packages renders
 * exactly the page it rendered before this sprint — same tabs, same order.
 */
export function ShopDetailWithMembership({ shopId }: { shopId: string }) {
  const t = useT(membershipDict);
  const { data: tiers } = usePublicTiers(shopId);

  return (
    <ShopDetailView
      shopId={shopId}
      membershipTab={
        (tiers?.length ?? 0) > 0
          ? { label: t("shopTabLabel"), content: <ShopMembershipTab shopId={shopId} /> }
          : null
      }
    />
  );
}
