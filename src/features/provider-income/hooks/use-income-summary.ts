"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import { useNowMs } from "@/hooks/use-now";
import type { ManualEntry, Serial } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { getIncomeHistory, getManualEntries, getShopServicesForEntries, toManualEntryRows } from "../api/income.api";
import { computeIncomeSummary, type IncomeSummary } from "../lib/compute-income";

const EMPTY: IncomeSummary = {
  today: { amount: 0, cash: 0, due: 0, doneCount: 0 },
  month: { amount: 0, cash: 0, due: 0, changePct: null },
  year: { amount: 0, cash: 0, due: 0 },
  monthlyTrend: [],
  byService: [],
  byStaff: [],
};

export function useIncomeSummary(shopId: string | undefined): {
  summary: IncomeSummary;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const serialsKey = keys.serials.incomeHistory(shopId ?? "");
  const manualKey = keys.manualEntries.byShop(shopId ?? "");
  const servicesKey = keys.services.byShop(shopId ?? "");
  // Recompute once a minute so "today"/"this month" roll over on their own
  // without needing a page refresh.
  const nowMs = useNowMs(60_000);

  const serialsQuery = useQuery({
    queryKey: serialsKey,
    queryFn: () => getIncomeHistory(shopId!),
    enabled: !!shopId,
  });

  const manualQuery = useQuery({
    queryKey: manualKey,
    queryFn: () => getManualEntries(shopId!),
    enabled: !!shopId,
  });

  // Same cache shape/key the services page uses (full rows, shop-scoped) —
  // shared across features when both happen to be warm.
  const servicesQuery = useQuery({
    queryKey: servicesKey,
    queryFn: () => getShopServicesForEntries(shopId!),
    enabled: !!shopId,
  });

  // Same channel key as the dashboard board — shares one subscription.
  useRealtimeChannel<Serial>({
    channelKey: `provider:${shopId ?? "none"}:serials`,
    table: "serials",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: serialsKey });
    },
  });

  // Manual entries added/edited/deleted from another tab or device (or by a
  // co-owner) should show up here without a page refresh too — invalidating
  // `manualKey` here also refreshes ManualEntrySection's list, since it reads
  // the exact same query key.
  useRealtimeChannel<ManualEntry>({
    channelKey: `provider:${shopId ?? "none"}:manual-entries`,
    table: "manual_entries",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: manualKey });
    },
  });

  // Only the serials query gates the loading spinner — manual entries (a
  // brand-new table) or the services lookup being unavailable shouldn't zero
  // out the income page that already worked before this table existed; they
  // just degrade to "no manual entries merged in yet" instead of blocking.
  const summary = useMemo(() => {
    if (!serialsQuery.data) return EMPTY;
    const nameById = new Map((servicesQuery.data ?? []).map((s) => [s.id, s.name]));
    const manualRows = toManualEntryRows(manualQuery.data ?? [], nameById);
    return computeIncomeSummary(serialsQuery.data, manualRows, new Date(nowMs), language);
  }, [serialsQuery.data, manualQuery.data, servicesQuery.data, nowMs, language]);

  return {
    summary,
    isPending: serialsQuery.isPending,
  };
}
