"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getMyFavoriteShopIds } from "../api/favorites.api";
import { getShopsByIds } from "../api/profile-history.api";

export function useMyFavoriteShops() {
  const idsQuery = useQuery({
    queryKey: keys.favorites.mine(),
    queryFn: getMyFavoriteShopIds,
  });

  const shopIds = [...(idsQuery.data ?? [])];

  const shopsQuery = useQuery({
    queryKey: ["shops", "by-ids", shopIds.slice().sort()],
    queryFn: () => getShopsByIds(shopIds),
    enabled: shopIds.length > 0,
  });

  const shops = shopIds.map((id) => shopsQuery.data?.[id]).filter((s) => !!s);

  return { shops, isPending: idsQuery.isPending };
}
