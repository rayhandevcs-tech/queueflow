"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import { useNowMs } from "@/hooks/use-now";
import type { ManualEntry, Serial } from "@/types";
import {
  getDueCount,
  getDueManualEntries,
  getDueManualEntryCount,
  getDueSerials,
  markDueCollected,
  markManualEntryCollected,
  sendDueReminders,
} from "../api/due-ledger.api";
import { computeDueLedger } from "../lib/compute-due-ledger";

export type { DueManualEntryRow } from "../api/due-ledger.api";

/** Sidebar's "বাকির খাতা" nav badge — serial dues + manual-entry dues combined. */
export function useDueCount(shopId: string | undefined) {
  const serialQuery = useQuery({
    queryKey: keys.dueLedger.countByShop(shopId ?? ""),
    queryFn: () => getDueCount(shopId!),
    enabled: !!shopId,
    refetchInterval: 30_000,
  });
  const manualQuery = useQuery({
    queryKey: keys.dueLedger.manualCountByShop(shopId ?? ""),
    queryFn: () => getDueManualEntryCount(shopId!),
    enabled: !!shopId,
    refetchInterval: 30_000,
  });
  return (serialQuery.data ?? 0) + (manualQuery.data ?? 0);
}

export function useDueLedger(shopId: string | undefined) {
  const queryClient = useQueryClient();
  const nowMs = useNowMs(60_000);
  const queryKey = keys.dueLedger.byShop(shopId ?? "");
  const manualQueryKey = keys.dueLedger.manualByShop(shopId ?? "");

  const dueQuery = useQuery({
    queryKey,
    queryFn: () => getDueSerials(shopId!),
    enabled: !!shopId,
  });

  const manualDueQuery = useQuery({
    queryKey: manualQueryKey,
    queryFn: () => getDueManualEntries(shopId!),
    enabled: !!shopId,
  });

  useRealtimeChannel<Serial>({
    channelKey: `provider:${shopId ?? "none"}:serials`,
    table: "serials",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => void queryClient.invalidateQueries({ queryKey }),
  });

  useRealtimeChannel<ManualEntry>({
    channelKey: `provider:${shopId ?? "none"}:manual-entries`,
    table: "manual_entries",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => void queryClient.invalidateQueries({ queryKey: manualQueryKey }),
  });

  const groups = useMemo(
    () => computeDueLedger(dueQuery.data ?? [], new Date(nowMs)),
    [dueQuery.data, nowMs],
  );
  const manualEntries = manualDueQuery.data ?? [];
  const totalDue =
    groups.reduce((sum, g) => sum + g.totalDue, 0) +
    manualEntries.reduce((sum, e) => sum + e.amount, 0);

  const invalidateAfterSettle = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: manualQueryKey });
    void queryClient.invalidateQueries({ queryKey: keys.dueLedger.countByShop(shopId ?? "") });
    void queryClient.invalidateQueries({ queryKey: keys.dueLedger.manualCountByShop(shopId ?? "") });
    void queryClient.invalidateQueries({ queryKey: keys.serials.today(shopId ?? "") });
    void queryClient.invalidateQueries({ queryKey: keys.serials.incomeHistory(shopId ?? "") });
    void queryClient.invalidateQueries({ queryKey: keys.manualEntries.byShop(shopId ?? "") });
  };

  const collect = useMutation({
    mutationFn: markDueCollected,
    onSuccess: invalidateAfterSettle,
  });

  const collectManual = useMutation({
    mutationFn: markManualEntryCollected,
    onSuccess: invalidateAfterSettle,
  });

  const remind = useMutation({
    mutationFn: sendDueReminders,
  });

  return {
    groups,
    manualEntries,
    totalDue,
    isPending: dueQuery.isPending || manualDueQuery.isPending,
    collect,
    collectManual,
    remind,
  };
}
