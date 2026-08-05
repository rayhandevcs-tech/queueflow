"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import type { ShopStatus } from "@/types";
import {
  amIPlatformAdmin,
  getOverviewStats,
  getShopDetail,
  listShops,
  setShopFeatured,
  setShopStatus,
  type AdminShopFilters,
} from "../api/admin.api";

export type { AdminShopRow, AdminShopDetail } from "../api/admin.api";

export const SHOPS_PAGE_SIZE = 25;

/** Server-side truth for "is this really an admin" (see api comment). */
export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: keys.admin.isAdmin(),
    queryFn: amIPlatformAdmin,
    staleTime: 5 * 60_000,
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: keys.admin.overview(),
    queryFn: getOverviewStats,
    // The panel is usually left open on a second monitor — keep the live
    // serial count and the pending queue honest without a manual refresh.
    refetchInterval: 60_000,
  });
}

interface UseAdminShopsArgs extends Omit<AdminShopFilters, "limit" | "offset"> {
  /** Grows by SHOPS_PAGE_SIZE on "load more" — one query, never a stitched cache. */
  pageSize: number;
}

export function useAdminShops({ status, businessType, search, pageSize }: UseAdminShopsArgs) {
  return useQuery({
    queryKey: keys.admin.shops({
      status: status ?? null,
      businessType: businessType ?? null,
      search: search?.trim() ?? "",
      pageSize,
    }),
    queryFn: () => listShops({ status, businessType, search, limit: pageSize, offset: 0 }),
    placeholderData: (previous) => previous,
  });
}

export function useAdminShop(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.admin.shopDetail(shopId ?? ""),
    queryFn: () => getShopDetail(shopId!),
    enabled: !!shopId,
  });
}

export function useAdminShopMutations(shopId?: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    // A status change flips the shop in/out of every customer-facing list.
    void queryClient.invalidateQueries({ queryKey: keys.shops.all });
  };

  const changeStatus = useMutation({
    mutationFn: ({
      status,
      reason,
      targetShopId,
    }: {
      status: ShopStatus;
      reason?: string | null;
      targetShopId?: string;
    }) => setShopStatus(targetShopId ?? shopId!, status, reason),
    onSuccess: invalidate,
  });

  const changeFeatured = useMutation({
    mutationFn: ({ featured, targetShopId }: { featured: boolean; targetShopId?: string }) =>
      setShopFeatured(targetShopId ?? shopId!, featured),
    onSuccess: invalidate,
  });

  return { changeStatus, changeFeatured };
}
