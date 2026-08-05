"use client";

import { StatusPill } from "@/components/ui/StatusPill";
import { useT } from "@/lib/i18n";
import type { ShopStatus } from "@/types";
import { adminDict } from "../lib/i18n";
import { SHOP_STATUS_LABEL_KEY, SHOP_STATUS_TONE } from "../lib/shop-status";

export function ShopStatusBadge({ status }: { status: ShopStatus }) {
  const t = useT(adminDict);
  return (
    <StatusPill tone={SHOP_STATUS_TONE[status]} label={t(SHOP_STATUS_LABEL_KEY[status])} />
  );
}
