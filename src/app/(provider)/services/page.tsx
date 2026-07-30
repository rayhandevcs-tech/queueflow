"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { ServicesManager } from "@/features/provider-catalog/components/ServicesManager";
import { CanPerformMatrix } from "@/features/provider-catalog/components/CanPerformMatrix";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

export default function ServicesPage() {
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
    <div className="space-y-8">
      <ServicesManager shopId={shop.id} />

      <div>
        <h2 className="mb-1 font-display text-lg font-bold text-ink">{t("canPerformHeading")}</h2>
        <p className="mb-3 text-sm text-muted">{t("canPerformDesc")}</p>
        <CanPerformMatrix shopId={shop.id} />
      </div>
    </div>
  );
}
