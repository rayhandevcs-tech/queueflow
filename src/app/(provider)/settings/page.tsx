"use client";

import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { ShopSettingsForm } from "@/features/provider-catalog/components/ShopSettingsForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";

export default function SettingsPage() {
  const { data: shop, isPending } = useMyShop();

  return (
    <div className="space-y-6">
      <PageHeader
        title="দোকানের সেটিংস"
        description={shop ? "তোমার দোকানের তথ্য আপডেট করো" : "প্রথমে দোকান সেট আপ করো"}
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
