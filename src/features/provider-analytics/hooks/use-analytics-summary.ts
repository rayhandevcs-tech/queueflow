"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import type { Serial } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { getAnalyticsHistory } from "../api/analytics.api";
import { computeAnalyticsSummary, type AnalyticsSummary } from "../lib/compute-analytics";

const EMPTY: AnalyticsSummary = {
  hasData: false,
  dailyAvgCustomers: null,
  peakHourLabel: null,
  avgServiceMin: null,
  hourlyLoad: [],
  weeklyLoad: [],
  insights: [],
};

export function useAnalyticsSummary(shopId: string | undefined): {
  summary: AnalyticsSummary;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const queryKey = keys.serials.analyticsHistory(shopId ?? "");

  const query = useQuery({
    queryKey,
    queryFn: () => getAnalyticsHistory(shopId!),
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

  const summary = useMemo(
    () => (query.data ? computeAnalyticsSummary(query.data, language) : EMPTY),
    [query.data, language],
  );

  return { summary, isPending: query.isPending };
}
