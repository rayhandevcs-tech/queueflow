"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getAllShopRatings } from "../api/ratings.api";

export function useShopRatings() {
  const query = useQuery({ queryKey: keys.ratingSummary.all(), queryFn: getAllShopRatings });

  const byShopId = useMemo(() => {
    const map = new Map<string, { avg_rating: number; review_count: number }>();
    for (const row of query.data ?? []) {
      map.set(row.shop_id, { avg_rating: row.avg_rating, review_count: row.review_count });
    }
    return map;
  }, [query.data]);

  return { ...query, byShopId };
}
