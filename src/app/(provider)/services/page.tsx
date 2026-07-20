"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { ServicesManager } from "@/features/provider-catalog/components/ServicesManager";
import { CanPerformMatrix } from "@/features/provider-catalog/components/CanPerformMatrix";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

export default function ServicesPage() {
  const { data: shop, isPending } = useMyShop();

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
        title="Set up your shop first"
        action={
          <Link href="/settings" className="text-sm font-semibold text-accent hover:underline">
            Go to settings →
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Services & Rates"
        description="Customers see this exact list when booking."
      />
      <ServicesManager shopId={shop.id} />

      <div>
        <h2 className="mb-1 font-display text-lg font-bold">Who can do what</h2>
        <p className="mb-3 text-sm text-muted">
          A service you turn off here will never be assigned to that chair.
        </p>
        <CanPerformMatrix shopId={shop.id} />
      </div>
    </div>
  );
}
