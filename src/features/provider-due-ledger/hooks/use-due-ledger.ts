"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import { useNowMs } from "@/hooks/use-now";
import type { Serial } from "@/types";
import { getDueCount, getDueSerials, markDueCollected, sendDueReminders } from "../api/due-ledger.api";
import { computeDueLedger } from "../lib/compute-due-ledger";

/** Sidebar's "বাকির খাতা" nav badge. */
export function useDueCount(shopId: string | undefined) {
  const query = useQuery({
    queryKey: keys.dueLedger.countByShop(shopId ?? ""),
    queryFn: () => getDueCount(shopId!),
    enabled: !!shopId,
    refetchInterval: 30_000,
  });
  return query.data ?? 0;
}

export function useDueLedger(shopId: string | undefined) {
  const queryClient = useQueryClient();
  const nowMs = useNowMs(60_000);
  const queryKey = keys.dueLedger.byShop(shopId ?? "");

  const dueQuery = useQuery({
    queryKey,
    queryFn: () => getDueSerials(shopId!),
    enabled: !!shopId,
  });

  useRealtimeChannel<Serial>({
    channelKey: `provider:${shopId ?? "none"}:serials`,
    table: "serials",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const groups = useMemo(
    () => computeDueLedger(dueQuery.data ?? [], new Date(nowMs)),
    [dueQuery.data, nowMs],
  );
  const totalDue = useMemo(() => groups.reduce((sum, g) => sum + g.totalDue, 0), [groups]);

  const invalidateAfterSettle = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: keys.dueLedger.countByShop(shopId ?? "") });
    void queryClient.invalidateQueries({ queryKey: keys.serials.today(shopId ?? "") });
    void queryClient.invalidateQueries({ queryKey: keys.serials.incomeHistory(shopId ?? "") });
  };

  const collect = useMutation({
    mutationFn: markDueCollected,
    onSuccess: invalidateAfterSettle,
  });

  const remind = useMutation({
    mutationFn: sendDueReminders,
  });

  return {
    groups,
    totalDue,
    isPending: dueQuery.isPending,
    collect,
    remind,
  };
}
