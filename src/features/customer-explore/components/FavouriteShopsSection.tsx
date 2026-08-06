"use client";

import { Heart } from "lucide-react";
import type { Shop } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n";
import { useMyFavoriteShopIds } from "../hooks/use-favorites";
import { ShopRail } from "./ShopRail";
import { customerExploreDict } from "../lib/i18n";

/**
 * The customer's own shortlist, on the screen they open first.
 *
 * Reuses the favourites the heart button already writes — no new data, just
 * the shops they've marked, filtered out of the list this page already has.
 */
export function FavouriteShopsSection({
  shops,
  ratingByShopId,
  waitMin,
}: {
  shops: Shop[] | undefined;
  ratingByShopId?: Map<string, { avg_rating: number; review_count: number }>;
  waitMin?: Record<string, number>;
}) {
  const { data: favoriteIds } = useMyFavoriteShopIds();
  const t = useT(customerExploreDict);

  const favourites = (shops ?? []).filter((shop) => favoriteIds?.has(shop.id));

  return (
    <ShopRail
      title={t("favouriteShopsHeading")}
      shops={favourites}
      ratingByShopId={ratingByShopId}
      waitMin={waitMin}
      empty={
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title={t("noFavouritesTitle")}
          description={t("noFavouritesDesc")}
        />
      }
    />
  );
}
