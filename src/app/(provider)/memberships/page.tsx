"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useMyShop } from "@/features/provider-catalog/hooks/use-my-shop";
import { MembershipManagerView } from "@/features/membership/components/MembershipManagerView";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

/**
 * Membership management.
 *
 * No business-type gate, unlike `/appointments`: a salon and a parlour both
 * sell memberships, and that is the whole point of keeping one business-scoped
 * model instead of two.
 */
export default function MembershipsPage() {
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

  return <MembershipManagerView shop={shop} />;
}
