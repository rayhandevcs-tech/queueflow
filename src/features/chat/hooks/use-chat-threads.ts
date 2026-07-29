"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import type { Message } from "@/types";
import {
  getCustomerNamesForShop,
  getMyThreadMessages,
  getMyUnreadChatCount,
  getShopsBasics,
  getShopThreadMessages,
  getShopUnreadChatCount,
} from "../api/chat.api";

export interface ChatThreadSummary {
  /** shopId for the customer side, customerId for the provider side. */
  key: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: Message;
  unread: boolean;
}

function useCurrentUserId() {
  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);
  return myId;
}

export function useMyChatThreads() {
  const myId = useCurrentUserId();

  const messagesQuery = useQuery({
    queryKey: keys.chatThreads.mine(),
    queryFn: () => getMyThreadMessages(myId!),
    enabled: !!myId,
  });

  const shopIds = useMemo(() => {
    const seen = new Set<string>();
    for (const m of messagesQuery.data ?? []) seen.add(m.shop_id);
    return [...seen];
  }, [messagesQuery.data]);

  const shopsQuery = useQuery({
    queryKey: ["chat-threads", "shop-basics", shopIds],
    queryFn: () => getShopsBasics(shopIds),
    enabled: shopIds.length > 0,
  });

  const threads = useMemo<ChatThreadSummary[]>(() => {
    if (!myId || !messagesQuery.data) return [];
    const byShop = new Map<string, ChatThreadSummary>();
    for (const m of messagesQuery.data) {
      const shop = shopsQuery.data?.[m.shop_id];
      const existing = byShop.get(m.shop_id);
      const unread = m.sender_id !== myId && !m.is_read;
      if (!existing) {
        byShop.set(m.shop_id, {
          key: m.shop_id,
          name: shop?.name ?? "দোকান",
          avatarUrl: shop?.logo_url ?? null,
          lastMessage: m,
          unread,
        });
      } else if (unread) {
        existing.unread = true;
      }
    }
    return [...byShop.values()];
  }, [myId, messagesQuery.data, shopsQuery.data]);

  return {
    threads,
    isPending: messagesQuery.isPending || (shopIds.length > 0 && shopsQuery.isPending),
  };
}

export function useShopChatThreads(shopId: string | undefined) {
  const messagesQuery = useQuery({
    queryKey: keys.chatThreads.byShop(shopId ?? ""),
    queryFn: () => getShopThreadMessages(shopId!),
    enabled: !!shopId,
  });

  const namesQuery = useQuery({
    queryKey: ["chat-threads", "customer-names", shopId],
    queryFn: () => getCustomerNamesForShop(shopId!),
    enabled: !!shopId,
  });

  const threads = useMemo<ChatThreadSummary[]>(() => {
    if (!messagesQuery.data) return [];
    const byCustomer = new Map<string, ChatThreadSummary>();
    for (const m of messagesQuery.data) {
      const name = namesQuery.data?.[m.customer_id] ?? "কাস্টমার";
      const existing = byCustomer.get(m.customer_id);
      const unread = m.sender_id === m.customer_id && !m.is_read;
      if (!existing) {
        byCustomer.set(m.customer_id, {
          key: m.customer_id,
          name,
          avatarUrl: null,
          lastMessage: m,
          unread,
        });
      } else if (unread) {
        existing.unread = true;
      }
    }
    return [...byCustomer.values()];
  }, [messagesQuery.data, namesQuery.data]);

  return {
    threads,
    isPending: messagesQuery.isPending || namesQuery.isPending,
  };
}

export function useMyUnreadChatCount() {
  const myId = useCurrentUserId();
  const query = useQuery({
    queryKey: keys.chatThreads.unreadCountMine(),
    queryFn: () => getMyUnreadChatCount(myId!),
    enabled: !!myId,
    refetchInterval: 30_000,
  });
  return query.data ?? 0;
}

export function useShopUnreadChatCount(shopId: string | undefined) {
  const myId = useCurrentUserId();
  const query = useQuery({
    queryKey: keys.chatThreads.unreadCountByShop(shopId ?? ""),
    queryFn: () => getShopUnreadChatCount(shopId!, myId!),
    enabled: !!shopId && !!myId,
    refetchInterval: 30_000,
  });
  return query.data ?? 0;
}
