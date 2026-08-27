"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import {
  applyListChange,
  byChairAndPosition,
} from "@/lib/query/realtime-cache";
import { ACTIVE_STATUSES } from "@/config/constants";
import type { Chair, Serial } from "@/types";
import { getAllChairs, getQueueStylePicks, getShopQueue } from "../api/queue.api";
import { buildLanes, boardTotals, type Lane } from "../lib/lanes";

export interface ProviderQueue {
  lanes: Lane[];
  totals: { waiting: number; inProgress: number };
  /**
   * The flat board rows, before lane grouping. Party badges need to see across
   * lanes — a family is deliberately spread over several chairs, so a lane on
   * its own can't tell you how many of them are still waiting.
   */
  rows: Serial[];
  isPending: boolean;
  isError: boolean;
}

/** Stable identity so an empty board doesn't re-render every consumer. */
const EMPTY_ROWS: Serial[] = [];

export function useProviderQueue(shopId: string): ProviderQueue {
  const queryClient = useQueryClient();
  const boardKey = keys.serials.byShop(shopId);
  const chairsKey = keys.chairs.byShop(shopId);

  // 1) Active serials — realtime-patched, never auto-refetched.
  const serialsQuery = useQuery({
    queryKey: boardKey,
    queryFn: () => getShopQueue(shopId),
    staleTime: Infinity,
  });

  // 2) Lane definitions — default staleness; chairs channel invalidates.
  const chairsQuery = useQuery({
    queryKey: chairsKey,
    queryFn: () => getAllChairs(shopId),
  });

  // Channel A — serials of this shop (owner RLS ⇒ full rows).
  useRealtimeChannel<Serial>({
    channelKey: `provider:${shopId}:serials`,
    table: "serials",
    filter: `shop_id=eq.${shopId}`,
    onChange: (payload) => {
      if (payload.eventType === "DELETE") {
        applyListChange(queryClient, boardKey, payload, byChairAndPosition);
        return;
      }
      const row = payload.new as Serial;
      if ((ACTIVE_STATUSES as readonly string[]).includes(row.status)) {
        // WAITING / IN_PROGRESS → upsert into the flat board array.
        applyListChange(queryClient, boardKey, payload, byChairAndPosition);
      } else {
        // DONE / CANCELLED / NO_SHOW → the card leaves the board.
        queryClient.setQueryData<Serial[]>(boardKey, (rows) =>
          rows ? rows.filter((r) => r.id !== row.id) : [],
        );
      }
    },
    invalidateOnReconnect: [boardKey, chairsKey],
  });

  // Channel B — lane add/remove/toggle: a 5-row refetch beats hand-patching.
  useRealtimeChannel<Chair>({
    channelKey: `provider:${shopId}:chairs`,
    table: "chairs",
    filter: `shop_id=eq.${shopId}`,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: chairsKey });
    },
    invalidateOnReconnect: [chairsKey],
  });

  // 3) Pure projection — recomputes only when either cache actually changes.
  const lanes = useMemo(
    () => buildLanes(serialsQuery.data, chairsQuery.data),
    [serialsQuery.data, chairsQuery.data],
  );

  const totals = useMemo(() => boardTotals(lanes), [lanes]);

  return {
    lanes,
    totals,
    rows: serialsQuery.data ?? EMPTY_ROWS,
    isPending: serialsQuery.isPending || chairsQuery.isPending,
    isError: serialsQuery.isError || chairsQuery.isError,
  };
}
/**
 * The style each customer on the board asked for.
 *
 * Keyed off the board's own serial ids, so it follows the board rather than
 * polling on its own. A pick changes at most once per booking, so this is
 * allowed to go stale for a minute — the board's realtime refetches are for
 * positions and statuses, not for this.
 */
export function useQueueStylePicks(serials: readonly Serial[]) {
  const ids = serials.map((s) => s.id).sort();

  return useQuery({
    queryKey: keys.stylePick.bySerial(ids.join(",")),
    queryFn: () => getQueueStylePicks(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}
