"use client";

import Link from "next/link";
import { CalendarClock, Settings } from "lucide-react";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { AppointmentListView } from "@/features/provider-appointments/components/AppointmentListView";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { providerAppointmentsDict } from "@/features/provider-appointments/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { isAppointmentModel } from "@/lib/business-model";
import { useT } from "@/lib/i18n";

/**
 * The appointment register.
 *
 * Gated on the business model rather than hidden only from the sidebar: a
 * salon has no appointments table rows to list, so landing here from a
 * bookmark should say so instead of showing an empty register that reads
 * like a bug. RLS is what actually protects the data — this is signposting.
 */
export default function AppointmentsPage() {
  const { data: shop, isPending } = useMyShop();
  const t = useT(providerCatalogDict);
  const at = useT(providerAppointmentsDict);

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

  if (!isAppointmentModel(shop.business_type)) {
    return (
      <EmptyState
        icon={<CalendarClock className="h-6 w-6" />}
        title={at("listQueueShopTitle")}
        description={at("listQueueShopBody")}
        action={
          <Link href="/dashboard" className="text-sm font-semibold text-accent hover:underline">
            {at("listQueueShopCta")}
          </Link>
        }
      />
    );
  }

  return <AppointmentListView shopId={shop.id} />;
}
