"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { AnalyticsDashboard } from "@/features/provider-analytics/components/AnalyticsDashboard";
import { AnalyticsView } from "@/features/provider-analytics/components/AnalyticsView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";

/**
 * The provider's analytics page.
 *
 * Sprint 10's dashboard, with the older queue-rhythm card kept and passed in
 * as a slot rather than replaced. They answer different questions — the
 * dashboard reports one chosen period, the rhythm card shows what a normal
 * week looks like over a fixed 90 days — and deleting a working screen to make
 * room for a new one is how a sprint breaks something nobody asked it to
 * touch.
 */
export default function AnalyticsPage() {
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

  return (
    <AnalyticsDashboard shop={shop} rhythmSlot={<AnalyticsView shopId={shop.id} embedded />} />
  );
}
