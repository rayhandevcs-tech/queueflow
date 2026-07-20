"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { QueuePublicRow, Serial } from "@/types";
import { getMyActiveSerial, getShopQueuePublic } from "../api/booking.api";

/** The signed-in customer's own active serial, kept live via realtime. */
export function useMyActiveSerial() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const query = useQuery({
    queryKey: keys.serials.mine(),
    queryFn: getMyActiveSerial,
  });

  useRealtimeChannel<Serial>({
    channelKey: `customer:${userId ?? "anon"}:serial`,
    table: "serials",
    filter: userId ? `customer_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: keys.serials.mine() });
    },
  });

  return query;
}

/** PII-free queue rows for a shop, kept live — powers the "ahead of you" list. */
export function useShopQueuePublic(shopId: string | undefined) {
  const queryClient = useQueryClient();
  const listKey = keys.queuePublic.byShop(shopId ?? "");

  const query = useQuery({
    queryKey: listKey,
    queryFn: () => getShopQueuePublic(shopId!),
    enabled: !!shopId,
  });

  useRealtimeChannel<QueuePublicRow>({
    channelKey: `queue-public:${shopId ?? "none"}`,
    table: "queue_public",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  return query;
}
