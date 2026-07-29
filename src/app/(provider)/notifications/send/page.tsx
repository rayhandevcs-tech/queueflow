"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { BroadcastForm } from "@/features/notifications/components/BroadcastForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

export default function SendNotificationPage() {
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
        title="আগে তোমার শপ সেট আপ করো"
        action={
          <Link href="/settings" className="text-sm font-semibold text-accent hover:underline">
            সেটিংসে যাও →
          </Link>
        }
      />
    );
  }

  return <BroadcastForm shopId={shop.id} />;
}
