"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";

type RealtimeTable =
  | "serials"
  | "queue_public"
  | "chairs"
  | "shops"
  | "services"
  | "chair_service_stats"
  | "reviews"
  | "regular_reminders";

type RealtimeEvent = "*" | "INSERT" | "UPDATE" | "DELETE";

export interface UseRealtimeChannelOptions<
  T extends Record<string, unknown>,
> {
  /** Unique per screen+scope, e.g. `queue:${shopId}` — duplicate keys share one channel. */
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

interface Subscriber {
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  reconnectKeys: ReadonlyArray<readonly unknown[]>;
}

interface SharedChannel {
  channel: RealtimeChannel;
  subscribers: Map<symbol, Subscriber>;
  hasSubscribedOnce: boolean;
  hadDrop: boolean;
}

/**
 * Module-level so multiple hook instances requesting the *same* channelKey
 * (e.g. a banner and a nav badge both watching "my active serial") share one
 * underlying Supabase realtime channel instead of each calling
 * `.channel(key).on(...).subscribe()` independently — Supabase throws if a
 * second `.on()` is added to an already-subscribed channel of the same name.
 * All callers of a given key are expected to agree on table/filter/event
 * (the key already encodes that scope by convention).
 */
const sharedChannels = new Map<string, SharedChannel>();

export function useRealtimeChannel<T extends Record<string, unknown>>(
  options: UseRealtimeChannelOptions<T>,
) {
  const {
    channelKey,
    table,
    filter,
    event = "*",
    enabled = true,
  } = options;
  const invalidateOnReconnect = options.invalidateOnReconnect ?? [];

  const queryClient = useQueryClient();
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol("realtime-subscriber");

  const onChangeRef = useRef(options.onChange);
  const reconnectKeysRef = useRef(invalidateOnReconnect);

  // Keep the latest callback/keys available to the shared dispatcher without
  // tearing down and recreating the channel on every render.
  useEffect(() => {
    onChangeRef.current = options.onChange;
    reconnectKeysRef.current = invalidateOnReconnect;
    const shared = sharedChannels.get(channelKey);
    const sub = shared?.subscribers.get(idRef.current!);
    if (sub) {
      sub.onChange = options.onChange as Subscriber["onChange"];
      sub.reconnectKeys = invalidateOnReconnect;
    }
  });

  useEffect(() => {
    if (!enabled) return;

    const id = idRef.current!;
    let shared = sharedChannels.get(channelKey);

    if (!shared) {
      const supabase = getBrowserClient();
      const entry: SharedChannel = {
        channel: null as unknown as RealtimeChannel,
        subscribers: new Map(),
        hasSubscribedOnce: false,
        hadDrop: false,
      };
      sharedChannels.set(channelKey, entry);

      entry.channel = supabase
        .channel(channelKey)
        .on(
          "postgres_changes",
          { event, schema: "public", table, ...(filter ? { filter } : {}) },
          (payload) => {
            for (const sub of entry.subscribers.values()) {
              sub.onChange(
                payload as RealtimePostgresChangesPayload<Record<string, unknown>>,
              );
            }
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            if (entry.hasSubscribedOnce && entry.hadDrop) {
              // We were live, lost the socket, and are live again:
              // reconcile everything every current subscriber depends on.
              const seen = new Set<string>();
              for (const sub of entry.subscribers.values()) {
                for (const key of sub.reconnectKeys) {
                  const sig = JSON.stringify(key);
                  if (seen.has(sig)) continue;
                  seen.add(sig);
                  void queryClient.invalidateQueries({ queryKey: key as unknown[] });
                }
              }
              entry.hadDrop = false;
            }
            entry.hasSubscribedOnce = true;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // supabase-js auto-rejoins; we just remember the gap.
            entry.hadDrop = true;
          }
        });

      shared = entry;
    }

    shared.subscribers.set(id, {
      onChange: onChangeRef.current as Subscriber["onChange"],
      reconnectKeys: reconnectKeysRef.current,
    });

    return () => {
      const entry = sharedChannels.get(channelKey);
      if (!entry) return;
      entry.subscribers.delete(id);
      if (entry.subscribers.size === 0) {
        sharedChannels.delete(channelKey);
        const supabase = getBrowserClient();
        void supabase.removeChannel(entry.channel);
      }
    };
  }, [channelKey, table, filter, event, enabled, queryClient]);
}
