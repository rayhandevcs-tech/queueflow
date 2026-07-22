"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import { useNowMs } from "@/hooks/use-now";
import type { Serial } from "@/types";
import { getRemindersSentThisMonth, getShopVisitHistory, sendReminder } from "../api/regulars.api";
import { computeRegulars } from "../lib/compute-regulars";

export function useRegulars(shopId: string | undefined) {
  const queryClient = useQueryClient();
  const nowMs = useNowMs(60_000);
  const remindersKey = keys.reminders.thisMonth(shopId ?? "");

  const visitsQuery = useQuery({
    queryKey: ["regulars", "visits", shopId ?? ""],
    queryFn: () => getShopVisitHistory(shopId!),
    enabled: !!shopId,
  });

  const remindersQuery = useQuery({
    queryKey: remindersKey,
    queryFn: () => getRemindersSentThisMonth(shopId!),
    enabled: !!shopId,
  });

  useRealtimeChannel<Serial>({
    channelKey: `provider:${shopId ?? "none"}:serials`,
    table: "serials",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: ["regulars", "visits", shopId ?? ""] });
    },
  });

  const regulars = useMemo(
    () => computeRegulars(visitsQuery.data ?? [], new Date(nowMs)),
    [visitsQuery.data, nowMs],
  );

  const remind = useMutation({
    mutationFn: sendReminder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remindersKey });
    },
  });

  return {
    regulars,
    sentKeys: remindersQuery.data ?? new Set<string>(),
    remind,
    isPending: visitsQuery.isPending,
  };
}
