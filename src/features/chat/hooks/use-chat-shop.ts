"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyShopId, getShopBasics } from "../api/chat.api";

export function useShopBasics(shopId: string) {
  return useQuery({
    queryKey: ["messages", "shop-basics", shopId],
    queryFn: () => getShopBasics(shopId),
    enabled: !!shopId,
  });
}

export function useMyShopId() {
  return useQuery({
    queryKey: ["messages", "my-shop-id"],
    queryFn: getMyShopId,
  });
}
