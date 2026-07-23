"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getShopDetail, getShopServices, hasServiceHistoryAtShop } from "../api/booking.api";

export function useShopDetail(shopId: string) {
  return useQuery({
    queryKey: keys.shops.detail(shopId),
    queryFn: () => getShopDetail(shopId),
    enabled: !!shopId,
  });
}

export function useShopServices(shopId: string) {
  return useQuery({
    queryKey: keys.services.byShop(shopId),
    queryFn: () => getShopServices(shopId),
  });
}

export function useHasShopHistory(shopId: string) {
  return useQuery({
    queryKey: keys.messages.hasHistoryAtShop(shopId),
    queryFn: () => hasServiceHistoryAtShop(shopId),
  });
}
