"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getShopDetail, getShopServices } from "../api/booking.api";

export function useShopDetail(shopId: string) {
  return useQuery({
    queryKey: keys.shops.detail(shopId),
    queryFn: () => getShopDetail(shopId),
  });
}

export function useShopServices(shopId: string) {
  return useQuery({
    queryKey: keys.services.byShop(shopId),
    queryFn: () => getShopServices(shopId),
  });
}
