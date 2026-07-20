"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";

type RealtimeTable =
  | "serials"
  | "queue_public"
  | "chairs"
  | "shops"
  | "services"
  | "chair_service_stats";

type RealtimeEvent = "*" | "INSERT" | "UPDATE" | "DELETE";

export interface UseRealtimeChannelOptions<
  T extends Record<string, unknown>,
> {
  /** Unique per screen+scope, e.g. `queue:${shopId}` — duplicate keys collide. */
  channelKey: string;
  table: RealtimeTable;
  /** Supabase realtime filter, e.g. `shop_id=eq.${shopId}` */
  filter?: string;
  event?: RealtimeEvent;
  /** Set false to hold the subscription (e.g. while shopId is undefined). */
  enabled?: boolean;
  /** Patch the cache here — the patch-don't-refetch pipeline. */
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void;
  /** Keys to invalidate after a drop→resubscribe (missed events are unknowable). */
  invalidateOnReconnect?: ReadonlyArray<readonly unknown[]>;
}

export function useRealtimeChannel<T extends Record<string, unknown>>(
  options: UseRealtimeChannelOptions<T>,
) {
  const {
    channelKey,
    table,
    filter,
    event = "*",
    enabled = true,
    invalidateOnReconnect,
  } = options;

  const queryClient = useQueryClient();

  // Latest-callback refs: re-renders must not resubscribe the channel.
  const onChangeRef = useRef(options.onChange);
  const reconnectKeysRef = useRef(invalidateOnReconnect ?? []);

  useEffect(() => {
    onChangeRef.current = options.onChange;
    reconnectKeysRef.current = invalidateOnReconnect ?? [];
  });

  useEffect(() => {
    if (!enabled) return;

    const supabase = getBrowserClient();
    let hasSubscribedOnce = false;
    let hadDrop = false;

    const channel = supabase
      .channel(channelKey)
      .on(
        "postgres_changes",
        {
          event,
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          onChangeRef.current(
            payload as RealtimePostgresChangesPayload<T>,
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (hasSubscribedOnce && hadDrop) {
            // We were live, lost the socket, and are live again:
            // reconcile everything this screen depends on.
            for (const key of reconnectKeysRef.current) {
              void queryClient.invalidateQueries({
                queryKey: key as unknown[],
              });
            }
            hadDrop = false;
          }
          hasSubscribedOnce = true;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // supabase-js auto-rejoins; we just remember the gap.
          hadDrop = true;
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelKey, table, filter, event, enabled, queryClient]);
}