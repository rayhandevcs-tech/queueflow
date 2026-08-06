"use client";

import type { Shop } from "@/types";
import { useT } from "@/lib/i18n";
import { ShopRail } from "./ShopRail";
import { customerExploreDict } from "../lib/i18n";

export function TopRatedSection({
  shops,
  ratingByShopId,
  waitMin,
}: {
  shops: Shop[] | undefined;
  ratingByShopId: Map<string, { avg_rating: number; review_count: number }>;
  waitMin?: Record<string, number>;
}) {
  const t = useT(customerExploreDict);

  const topRated = (shops ?? [])
    .filter((shop) => (ratingByShopId.get(shop.id)?.review_count ?? 0) > 0)
    .sort(
      (a, b) =>
        (ratingByShopId.get(b.id)?.avg_rating ?? 0) - (ratingByShopId.get(a.id)?.avg_rating ?? 0),
    )
    .slice(0, 8);

  return (
    <ShopRail
      title={t("topRatedHeading")}
      shops={topRated}
      ratingByShopId={ratingByShopId}
      waitMin={waitMin}
    />
  );
}
