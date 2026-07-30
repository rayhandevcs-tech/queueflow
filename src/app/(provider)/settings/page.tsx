"use client";

import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { ShopSettingsForm } from "@/features/provider-catalog/components/ShopSettingsForm";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const { data: shop, isPending } = useMyShop();
  const t = useT(providerCatalogDict);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settingsPageTitle")}
        description={shop ? t("settingsDescExisting") : t("settingsDescNew")}
      />
      {isPending ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="h-6 w-6 text-muted" />
        </div>
      ) : (
        <ShopSettingsForm shop={shop ?? null} />
      )}
    </div>
  );
}
