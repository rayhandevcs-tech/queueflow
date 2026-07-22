"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { Review } from "@/types";
import { getSerialCustomerNames, getShopReviews } from "../api/reviews.api";
import { computeReviewSummary } from "../lib/compute-reviews";

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

  const namesQuery = useQuery({
    queryKey: ["reviews", "names", serialIds.slice().sort()],
    queryFn: () => getSerialCustomerNames(serialIds),
    enabled: serialIds.length > 0,
  });

  const summary = useMemo(() => computeReviewSummary(reviewsQuery.data ?? []), [reviewsQuery.data]);

  return {
    reviews: reviewsQuery.data ?? [],
    namesBySerial: namesQuery.data ?? {},
    summary,
    isPending: reviewsQuery.isPending,
  };
}
