"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import type { Shop } from "@/types";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { ChairsManager } from "@/features/provider-catalog/components/ChairsManager";
import { StaffAvailabilityManager } from "@/features/provider-appointments/components/StaffAvailabilityManager";
import { useChairs } from "@/features/provider-catalog/hooks/use-chairs";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useLanguage, useT } from "@/lib/i18n";
import { useTerms } from "@/lib/business-terms";
import { byModel, isAppointmentModel } from "@/lib/business-model";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";

export default function ChairsPage() {
  const { data: shop, isPending } = useMyShop();
  const t = useT(providerCatalogDict);
  const { language } = useLanguage();
  const tt = useTerms(shop?.business_type, language);

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
    <div className="space-y-6">
      <PageHeader
        title={tt("chairs")}
        description={t(
          byModel(shop.business_type, {
            QUEUE: "chairsPageDescQueue",
            APPOINTMENT: "chairsPageDescAppointment",
          }),
          tt("chair"),
        )}
      />
      <ChairsManager shopId={shop.id} businessType={shop.business_type} />

      {/* Only the appointment model has per-person hours: a queue has no clock
          to schedule against, so a salon would be configuring nothing. */}
      {isAppointmentModel(shop.business_type) && <StaffSchedule shopId={shop.id} shop={shop} />}
    </div>
  );
}

/** Split out so the chairs query only runs for the shops that use it. */
function StaffSchedule({ shopId, shop }: { shopId: string; shop: Shop }) {
  const { data: chairs } = useChairs(shopId);
  if (!chairs || chairs.length === 0) return null;
  return <StaffAvailabilityManager shop={shop} chairs={chairs} />;
}
