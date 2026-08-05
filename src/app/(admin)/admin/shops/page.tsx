"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShopsListView } from "@/features/admin/components/ShopsListView";
import { adminDict } from "@/features/admin/lib/i18n";
import { SHOP_STATUSES } from "@/config/constants";
import { useT } from "@/lib/i18n";
import type { ShopStatus } from "@/types";

function ShopsPageInner() {
  const t = useT(adminDict);
  const searchParams = useSearchParams();
  const raw = searchParams.get("status");
  // Overview's stat cards deep-link here with ?status=… — anything else is ignored.
  const initialStatus = SHOP_STATUSES.includes(raw as ShopStatus)
    ? (raw as ShopStatus)
    : null;

  return (
    <ShopsListView
      title={t("shopsTitle")}
      description={t("shopsSubtitle")}
      initialStatus={initialStatus}
    />
  );
}

export default function AdminShopsPage() {
  return (
    <Suspense fallback={null}>
      <ShopsPageInner />
    </Suspense>
  );
}
