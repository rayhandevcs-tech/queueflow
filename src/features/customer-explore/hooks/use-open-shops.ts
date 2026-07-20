"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { QueuePublicRow } from "@/types";
import { getActiveQueueCounts, getOpenShops } from "../api/shops.api";

export function useOpenShops() {
  return useQuery({ queryKey: keys.shops.open(), queryFn: getOpenShops });
}

/** Live "N waiting" badge per shop on the explore list. */
export function useQueueCounts() {
  const queryClient = useQueryClient();
  const listKey = keys.queuePublic.counts();

  const query = useQuery({ queryKey: listKey, queryFn: getActiveQueueCounts });

  useRealtimeChannel<QueuePublicRow>({
    channelKey: "explore:queue-public",
    table: "queue_public",
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  return query;
}
