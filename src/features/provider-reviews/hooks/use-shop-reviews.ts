"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { Review } from "@/types";
import { computeReviewSummary } from "@/lib/reviews";
import { getChairNames, getSerialCustomerInfo, getShopReviews } from "../api/reviews.api";

export function useShopReviews(shopId: string | undefined) {
  const queryClient = useQueryClient();
  const reviewsKey = keys.reviews.byShop(shopId ?? "");

  const reviewsQuery = useQuery({
    queryKey: reviewsKey,
    queryFn: () => getShopReviews(shopId!),
    enabled: !!shopId,
  });

  useRealtimeChannel<Review>({
    channelKey: `provider:${shopId ?? "none"}:reviews`,
    table: "reviews",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: reviewsKey });
    },
  });

  const serialIds = useMemo(
    () => (reviewsQuery.data ?? []).map((r) => r.serial_id),
    [reviewsQuery.data],
  );

  const customerInfoQuery = useQuery({
    queryKey: ["reviews", "customer-info", serialIds.slice().sort()],
    queryFn: () => getSerialCustomerInfo(serialIds),
    enabled: serialIds.length > 0,
  });

  const chairNamesQuery = useQuery({
    queryKey: ["reviews", "chair-names", shopId],
    queryFn: () => getChairNames(shopId!),
    enabled: !!shopId,
  });

  // Hidden reviews stay in the list (with a badge) but out of the headline
  // average, so the owner's number matches what customers actually see —
  // shop_rating_summary filters them out on the DB side too.
  const summary = useMemo(
    () => computeReviewSummary((reviewsQuery.data ?? []).filter((r) => !r.hidden_at)),
    [reviewsQuery.data],
  );

  return {
    reviews: reviewsQuery.data ?? [],
    customerInfoBySerial: customerInfoQuery.data ?? {},
    staffNameByChairId: chairNamesQuery.data ?? {},
    summary,
    isPending: reviewsQuery.isPending,
  };
}
