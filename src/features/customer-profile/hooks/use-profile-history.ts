"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { Serial } from "@/types";
import { getMyAllSerials, getMyRatingsBySerial, getShopsByIds } from "../api/profile-history.api";
import { computeTrustSummary } from "../lib/trust-score";

export function useProfileHistory() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const historyQuery = useQuery({
    queryKey: keys.serials.myHistory(),
    queryFn: getMyAllSerials,
  });

  useRealtimeChannel<Serial>({
    channelKey: `customer:${userId ?? "anon"}:history`,
    table: "serials",
    filter: userId ? `customer_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: keys.serials.myHistory() });
    },
  });

  const shopIds = useMemo(
    () => [...new Set((historyQuery.data ?? []).map((s) => s.shop_id))],
    [historyQuery.data],
  );

  const shopsQuery = useQuery({
    queryKey: ["shops", "by-ids", shopIds.slice().sort()],
    queryFn: () => getShopsByIds(shopIds),
    enabled: shopIds.length > 0,
  });

  const ratingsQuery = useQuery({
    queryKey: keys.reviews.mine(),
    queryFn: getMyRatingsBySerial,
  });

  const trust = useMemo(() => computeTrustSummary(historyQuery.data ?? []), [historyQuery.data]);

  return {
    history: historyQuery.data ?? [],
    shopsById: shopsQuery.data ?? {},
    ratingsBySerial: ratingsQuery.data ?? {},
    trust,
    isPending: historyQuery.isPending,
  };
}
