"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { computeReviewSummary } from "@/lib/reviews";
import { getShopReviewsPublic } from "../api/booking.api";

export function useShopReviewsPublic(shopId: string | undefined) {
  const query = useQuery({
    queryKey: keys.reviews.publicByShop(shopId ?? ""),
    queryFn: () => getShopReviewsPublic(shopId!),
    enabled: !!shopId,
  });

  const summary = useMemo(() => computeReviewSummary(query.data ?? []), [query.data]);

  return {
    reviews: query.data ?? [],
    summary,
    isPending: query.isPending,
  };
}
