"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { Serial } from "@/types";
import { getLiveQueueCount, getTodaySummary } from "../api/queue.api";

/** Shares the dashboard board's realtime channel — same table+filter, same key. */
function useShopSerialsChannel(shopId: string | undefined, onChange: () => void) {
  useRealtimeChannel<Serial>({
    channelKey: `provider:${shopId ?? "none"}:serials`,
    table: "serials",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange,
  });
}

/** Sidebar's live-count badge, kept fresh without pulling the full board. */
export function useLiveQueueCount(shopId: string | undefined): number {
  const queryClient = useQueryClient();
  const queryKey = keys.serials.liveCount(shopId ?? "");

  const query = useQuery({
    queryKey,
    queryFn: () => getLiveQueueCount(shopId!),
    enabled: !!shopId,
  });

  useShopSerialsChannel(shopId, () => {
    void queryClient.invalidateQueries({ queryKey });
  });

  return query.data ?? 0;
}

/** Sidebar's pinned today-income card. */
export function useTodaySummary(shopId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = keys.serials.today(shopId ?? "");

  const query = useQuery({
    queryKey,
    queryFn: () => getTodaySummary(shopId!),
    enabled: !!shopId,
  });

  useShopSerialsChannel(shopId, () => {
    void queryClient.invalidateQueries({ queryKey });
  });

  return query.data ?? { doneCount: 0, income: 0 };
}
