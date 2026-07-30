"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import { useNowMs } from "@/hooks/use-now";
import type { Serial } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { getIncomeHistory } from "../api/income.api";
import { computeIncomeSummary, type IncomeSummary } from "../lib/compute-income";

const EMPTY: IncomeSummary = {
  today: { amount: 0, doneCount: 0 },
  month: { amount: 0, changePct: null },
  year: { amount: 0 },
  monthlyTrend: [],
  byService: [],
};

export function useIncomeSummary(shopId: string | undefined): {
  summary: IncomeSummary;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const queryKey = keys.serials.incomeHistory(shopId ?? "");
  // Recompute once a minute so "today"/"this month" roll over on their own
  // without needing a page refresh.
  const nowMs = useNowMs(60_000);

  const query = useQuery({
    queryKey,
    queryFn: () => getIncomeHistory(shopId!),
    enabled: !!shopId,
  });

  // Same channel key as the dashboard board — shares one subscription.
  useRealtimeChannel<Serial>({
    channelKey: `provider:${shopId ?? "none"}:serials`,
    table: "serials",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const summary = useMemo(() => {
    if (!query.data) return EMPTY;
    return computeIncomeSummary(query.data, new Date(nowMs), language);
  }, [query.data, nowMs, language]);

  return { summary, isPending: query.isPending };
}
