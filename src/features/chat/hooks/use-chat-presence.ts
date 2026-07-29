"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Ephemeral online/offline for the other party in a chat thread, via
 * Supabase Realtime Presence (ephemeral by nature — nothing persisted, so
 * there's no true "last seen" once both sides leave; callers should fall
 * back to the last message timestamp for that case).
 */
export function useChatPresence(
  channelKey: string | undefined,
  myId: string | undefined,
): boolean {
  const [otherOnline, setOtherOnline] = useState(false);

  useEffect(() => {
    if (!channelKey || !myId) return;

    const supabase = getBrowserClient();
    const channel = supabase.channel(channelKey, { config: { presence: { key: myId } } });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOtherOnline(Object.keys(state).some((key) => key !== myId));
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ online_at: Date.now() });
      }
    });

    return () => {
      setOtherOnline(false);
      void supabase.removeChannel(channel);
    };
  }, [channelKey, myId]);

  return otherOnline;
}
