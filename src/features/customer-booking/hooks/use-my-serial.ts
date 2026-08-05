"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { QueuePublicRow, Serial } from "@/types";
import { getMyActiveSerials, getShopQueuePublic } from "../api/booking.api";

/**
 * The signed-in customer's own active booking, kept live via realtime.
 *
 * Returns an array because a booking can be a party — one row for a solo
 * serial, up to five for a family. Callers that only care about the customer
 * themselves want `[0]`, the lead.
 */
export function useMyActiveSerials() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const query = useQuery({
    queryKey: keys.serials.mine(),
    queryFn: getMyActiveSerials,
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

/**
 * Just the lead row — for the many places that only ask "do I have a booking,
 * and where is it". A party's lead is the customer's own serial, so this is
 * still the right answer for the nav badge, the banner and the shop page.
 */
export function useMyActiveSerial() {
  const { data, isPending, isError } = useMyActiveSerials();
  return { data: data?.[0] ?? null, isPending, isError };
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
