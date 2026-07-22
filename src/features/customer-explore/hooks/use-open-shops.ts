"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import { chairFreeAtMs, minutesUntil } from "@/lib/queue-wait";
import type { QueuePublicRow } from "@/types";
import { getLiveQueue, getOpenShops } from "../api/shops.api";

export function useOpenShops() {
  return useQuery({ queryKey: keys.shops.open(), queryFn: getOpenShops });
}

/**
 * Live "N waiting" + "~M min wait" per shop, derived from the shared
 * queue_public snapshot. Wait estimate = soonest a currently-busy chair at
 * that shop frees up (min across its chairs); shops with no live queue rows
 * at all read as 0 (idle chairs with zero queue aren't visible in this view,
 * so this slightly over-estimates a shop that's only partially busy).
 */
export function useShopLiveStats() {
  const queryClient = useQueryClient();
  const listKey = keys.queuePublic.counts();

  const query = useQuery({ queryKey: listKey, queryFn: getLiveQueue });

  useRealtimeChannel<QueuePublicRow>({
    channelKey: "explore:queue-public",
    table: "queue_public",
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  // Ticks periodically so the wait estimate (derived from "now") stays fresh
  // without calling Date.now() directly inside the render-time useMemo below.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { counts, waitMin } = useMemo(() => {
    const rows = query.data ?? [];
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.shop_id] = (counts[row.shop_id] ?? 0) + 1;
    }

    const freeMap = chairFreeAtMs(rows, (r) => `${r.shop_id}:${r.chair_id}`);
    const freeAtByShop = new Map<string, number[]>();
    for (const [chairKey, freeAtMs] of freeMap) {
      const shopId = chairKey.slice(0, chairKey.indexOf(":"));
      const list = freeAtByShop.get(shopId);
      if (list) list.push(freeAtMs);
      else freeAtByShop.set(shopId, [freeAtMs]);
    }

    const waitMin: Record<string, number> = {};
    for (const [shopId, freeAtList] of freeAtByShop) {
      waitMin[shopId] = minutesUntil(freeAtList, nowMs) ?? 0;
    }

    return { counts, waitMin };
  }, [query.data, nowMs]);

  return { counts, waitMin, isPending: query.isPending };
}
