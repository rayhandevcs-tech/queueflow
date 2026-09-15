"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useLoyaltySettings } from "@/features/loyalty/hooks/use-loyalty";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { useServices } from "@/features/provider-catalog/hooks/use-services";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { RewardManagerView } from "@/features/rewards/components/RewardManagerView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

/**
 * The reward catalogue, and the counter flow for checking a coupon.
 *
 * No business-type gate: a salon honours a reward on a finished serial and a
 * parlour on a finished appointment, and both go through the same trigger.
 *
 * The loyalty settings and the service list are read here rather than inside
 * the rewards feature, because they belong to loyalty and to the catalogue,
 * and features may not import each other. It is also the honest shape of the
 * dependency — a reward is bought with loyalty points and may give away a
 * service, and rewards owns neither of those things.
 */
export default function RewardsPage() {
  const { data: shop, isPending } = useMyShop();
  const { data: loyaltySettings } = useLoyaltySettings(shop?.id);
  const { data: services } = useServices(shop?.id);
  const t = useT(providerCatalogDict);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!shop) {
    return (
      <EmptyState
        icon={<Settings className="h-6 w-6" />}
        title={t("noShopTitle")}
        action={
          <Link href="/settings" className="text-sm font-semibold text-accent hover:underline">
            {t("goToSettings")}
          </Link>
        }
      />
    );
  }

  return (
    <RewardManagerView shop={shop} loyaltySettings={loyaltySettings} services={services} />
  );
}
