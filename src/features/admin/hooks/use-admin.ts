"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import type { ReportStatus, ShopStatus } from "@/types";
import {
  amIPlatformAdmin,
  deleteUser,
  forceCancelSerial,
  getOverviewStats,
  getShopDetail,
  getUserDetail,
  listReports,
  listShops,
  listUsers,
  resolveReport,
  runAccountAction,
  setReviewHidden,
  setShopFeatured,
  setShopStatus,
  setUserBlocked,
  updateUserProfile,
  type AdminAccountAction,
  type AdminProfilePatch,
  type AdminShopFilters,
  type AdminUserFilters,
} from "../api/admin.api";

export type {
  AdminShopRow,
  AdminShopDetail,
  AdminUserRow,
  AdminUserDetail,
  AdminReportRow,
} from "../api/admin.api";

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

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

interface UseAdminUsersArgs extends Omit<AdminUserFilters, "limit" | "offset"> {
  pageSize: number;
}

export function useAdminUsers({ role, blocked, search, pageSize }: UseAdminUsersArgs) {
  return useQuery({
    queryKey: keys.admin.users({
      role: role ?? null,
      blocked: blocked ?? null,
      search: search?.trim() ?? "",
      pageSize,
    }),
    queryFn: () => listUsers({ role, blocked, search, limit: pageSize, offset: 0 }),
    placeholderData: (previous) => previous,
  });
}

export function useAdminUser(userId: string | undefined) {
  return useQuery({
    queryKey: keys.admin.userDetail(userId ?? ""),
    queryFn: () => getUserDetail(userId!),
    enabled: !!userId,
  });
}

export function useAdminUserMutations(userId?: string) {
  const queryClient = useQueryClient();

  const changeBlocked = useMutation({
    mutationFn: ({
      blocked,
      reason,
      targetUserId,
    }: {
      blocked: boolean;
      reason?: string | null;
      targetUserId?: string;
    }) => setUserBlocked(targetUserId ?? userId!, blocked, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const editProfile = useMutation({
    mutationFn: (patch: AdminProfilePatch) => updateUserProfile(userId!, patch),
    onSuccess: invalidate,
  });

  const accountAction = useMutation({
    mutationFn: (input: { action: AdminAccountAction; email?: string }) =>
      runAccountAction({ ...input, userId: userId! }),
    onSuccess: invalidate,
  });

  const cancelSerial = useMutation({
    mutationFn: ({ serialId, reason }: { serialId: string; reason?: string | null }) =>
      forceCancelSerial(serialId, reason),
    onSuccess: () => {
      void invalidate();
      // The shop's live board and the customer's tracking screen both change.
      void queryClient.invalidateQueries({ queryKey: ["serials"] });
      void queryClient.invalidateQueries({ queryKey: ["queue-public"] });
    },
  });

  const removeAccount = useMutation({
    mutationFn: (reason?: string | null) => deleteUser(userId!, reason),
    onSuccess: () => {
      void invalidate();
      // A deleted provider takes their shop (and its serials) with them.
      void queryClient.invalidateQueries({ queryKey: keys.shops.all });
    },
  });

  return { changeBlocked, editProfile, accountAction, cancelSerial, removeAccount };
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export function useAdminReports(status: ReportStatus | null) {
  return useQuery({
    queryKey: keys.admin.reports(status),
    queryFn: () => listReports(status),
    placeholderData: (previous) => previous,
  });
}

export function useModerationMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    // Hiding a review moves the shop's star average — customer-facing caches
    // for reviews and rating summaries have to go too.
    void queryClient.invalidateQueries({ queryKey: ["reviews"] });
    void queryClient.invalidateQueries({ queryKey: ["rating-summary"] });
  };

  const resolve = useMutation({
    mutationFn: ({
      reportId,
      status,
      note,
    }: {
      reportId: string;
      status: ReportStatus;
      note?: string | null;
    }) => resolveReport(reportId, status, note),
    onSuccess: invalidate,
  });

  const hideReview = useMutation({
    mutationFn: ({
      reviewId,
      hidden,
      reason,
    }: {
      reviewId: string;
      hidden: boolean;
      reason?: string | null;
    }) => setReviewHidden(reviewId, hidden, reason),
    onSuccess: invalidate,
  });

  return { resolve, hideReview };
}
