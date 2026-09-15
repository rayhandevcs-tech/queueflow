"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useLoyaltySettings } from "@/features/loyalty/hooks/use-loyalty";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { ReferralManagerView } from "@/features/referral/components/ReferralManagerView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

/**
 * Referral statistics and rules.
 *
 * No business-type gate: a salon qualifies a referral from a finished serial
 * and a parlour from a finished appointment, and both go through the same
 * trigger.
 *
 * The loyalty settings are read here rather than inside the referral feature,
 * because they belong to loyalty and features may not import each other. It
 * is also the honest shape of the dependency — referral has no settings table
 * of its own, since a referral reward *is* a loyalty point.
 */
export default function ReferralsPage() {
  const { data: shop, isPending } = useMyShop();
  const { data: settings } = useLoyaltySettings(shop?.id);
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

  return <ReferralManagerView shop={shop} settings={settings} />;
}
