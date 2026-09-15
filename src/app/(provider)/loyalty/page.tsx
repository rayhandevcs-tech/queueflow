"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { LoyaltyManagerView } from "@/features/loyalty/components/LoyaltyManagerView";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

/**
 * Loyalty points.
 *
 * No business-type gate: a salon earns points from finished serials and a
 * parlour from finished appointments, and both go through the same trigger.
 */
export default function LoyaltyPage() {
  const { data: shop, isPending } = useMyShop();
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

  return <LoyaltyManagerView shop={shop} />;
}
