"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { Message } from "@/types";
import { translate } from "@/lib/i18n";
import { getThreadMessages, markThreadRead, sendMessage } from "../api/chat.api";
import { chatDict } from "../lib/i18n";

export function useChatThread(shopId: string | undefined, customerId: string | undefined) {
  const queryClient = useQueryClient();
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

  const enabled = !!shopId && !!customerId;
  const queryKey = useMemo(
    () => keys.messages.thread(shopId ?? "", customerId ?? ""),
    [shopId, customerId],
  );

  const messagesQuery = useQuery({
    queryKey,
    queryFn: () => getThreadMessages(shopId!, customerId!),
    enabled,
  });

  useRealtimeChannel<Message>({
    channelKey: enabled ? `chat:${shopId}:${customerId}` : "chat:disabled",
    table: "messages",
    filter: enabled ? `shop_id=eq.${shopId}` : undefined,
    event: "INSERT",
    enabled,
    onChange: (payload) => {
      const msg = payload.new as Message;
      if (msg.customer_id !== customerId) return;
      queryClient.setQueryData<Message[]>(queryKey, (prev) => {
        if (!prev) return [msg];
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (myId && msg.sender_id !== myId) {
        void markThreadRead(shopId!, customerId!, myId);
      }
      void queryClient.invalidateQueries({ queryKey: keys.chatThreads.mine() });
      void queryClient.invalidateQueries({ queryKey: keys.chatThreads.byShop(shopId!) });
      void queryClient.invalidateQueries({ queryKey: keys.chatThreads.unreadCountMine() });
      void queryClient.invalidateQueries({ queryKey: keys.chatThreads.unreadCountByShop(shopId!) });
    },
  });

  useEffect(() => {
    if (enabled && myId && messagesQuery.data?.length) {
      void markThreadRead(shopId!, customerId!, myId);
    }
  }, [enabled, shopId, customerId, myId, messagesQuery.data]);

  const send = useMutation({
    mutationFn: (params: { content?: string; imageUrls?: string[] }) => {
      if (!shopId || !customerId || !myId) throw new Error(translate(chatDict, "chatNotReady"));
      return sendMessage({ shopId, customerId, senderId: myId, ...params });
    },
  });

  return {
    myId,
    messages: messagesQuery.data ?? [],
    isPending: messagesQuery.isPending,
    send,
  };
}
