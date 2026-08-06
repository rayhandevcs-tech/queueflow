"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { QueuePublicRow } from "@/types";
import { getDisplayBoard } from "../api/display.api";

/**
 * The counter board, kept live.
 *
 * Realtime on `queue_public` is the primary signal, exactly as the customer
 * screens use. The slow poll underneath it is not redundant: this screen is
 * meant to run untouched for a whole working day on a spare phone, where a
 * websocket will eventually drop and nobody is watching to notice. It also
 * covers the one thing no row change announces — a break simply expiring.
 */
export function useDisplayBoard(shopId: string) {
  const queryClient = useQueryClient();
  const boardKey = keys.display.board(shopId);

  const query = useQuery({
    queryKey: boardKey,
    queryFn: () => getDisplayBoard(shopId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useRealtimeChannel<QueuePublicRow>({
    channelKey: `display:${shopId}`,
    table: "queue_public",
    filter: `shop_id=eq.${shopId}`,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey });
    },
    invalidateOnReconnect: [boardKey],
  });

  return query;
}

/**
 * Asks the browser to keep the screen awake.
 *
 * A display that blanks after 30 seconds is not a display. Wake Lock is
 * Chromium-only and needs a secure context, so every step is optional —
 * failure just means the shop turns their screen timeout up themselves.
 */
export function useScreenWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined") return;

    type WakeLockSentinel = { release: () => Promise<void> };
    type WakeLockNavigator = Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };

    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = () => {
      wakeLock
        .request("screen")
        .then((s) => {
          if (released) void s.release();
          else sentinel = s;
        })
        .catch(() => {
          // Denied, or the tab wasn't visible. Nothing to do — the page still works.
        });
    };

    // The lock is dropped whenever the tab is hidden, so re-take it on return.
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
