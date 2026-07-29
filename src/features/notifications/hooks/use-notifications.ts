"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { Notification } from "@/types";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications.api";

/** The signed-in user's own notifications, kept live via realtime. */
export function useMyNotifications() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const listKey = keys.notifications.mine(userId ?? "anon");

  const query = useQuery({
    queryKey: listKey,
    queryFn: () => getMyNotifications(userId!),
    enabled: !!userId,
  });

  useRealtimeChannel<Notification>({
    channelKey: `customer:${userId ?? "anon"}:notifications`,
    table: "notifications",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: listKey }),
  });

  return { ...query, notifications, unreadCount, markRead, markAllRead };
}
