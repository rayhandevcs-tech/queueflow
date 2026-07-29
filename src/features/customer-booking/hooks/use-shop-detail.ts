"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  getChairServiceCapabilities,
  getShopChairs,
  getShopDetail,
  getShopGallery,
  getShopServices,
  hasServiceHistoryAtShop,
} from "../api/booking.api";

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

export function useShopGallery(shopId: string) {
  return useQuery({
    queryKey: keys.shopGallery.byShop(shopId),
    queryFn: () => getShopGallery(shopId),
    enabled: !!shopId,
  });
}

export function useShopChairs(shopId: string) {
  return useQuery({
    queryKey: keys.chairs.publicByShop(shopId),
    queryFn: () => getShopChairs(shopId),
    enabled: !!shopId,
  });
}

/**
 * Groups chair_service_stats rows by chair_id — but only the explicit
 * can_perform=false ones. A chair with no row for a service has no entry
 * here, which callers must treat as "capable" (default-allow, matching
 * CanPerformMatrix's own semantics) rather than "unknown/excluded".
 */
export function useChairCapabilities(serviceIds: string[]) {
  const sortedIds = useMemo(() => serviceIds.slice().sort(), [serviceIds]);
  const query = useQuery({
    queryKey: keys.chairStats.capabilities(sortedIds),
    queryFn: () => getChairServiceCapabilities(sortedIds),
    enabled: sortedIds.length > 0,
  });

  const blockedByChairId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of query.data ?? []) {
      if (row.can_perform) continue;
      const set = map.get(row.chair_id) ?? new Set<string>();
      set.add(row.service_id);
      map.set(row.chair_id, set);
    }
    return map;
  }, [query.data]);

  return { ...query, blockedByChairId };
}
