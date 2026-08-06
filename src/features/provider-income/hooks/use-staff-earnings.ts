"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useNowMs } from "@/hooks/use-now";
import {
  getIncomeHistory,
  getManualEntries,
  getShopChairsForEntries,
  getShopServicesForEntries,
  toManualEntryRows,
} from "../api/income.api";
import { computeStaffEarnings, type StaffEarning } from "../lib/compute-profit";

export type EarningsPeriod = "month" | "year";

/**
 * Per-staff takings and commission.
 *
 * Reads the same three caches the income summary already fills — this is a
 * different slice of data the page has, not a new round trip.
 */
export function useStaffEarnings(shopId: string | undefined, period: EarningsPeriod) {
  const nowMs = useNowMs(60_000);

  const serialsQuery = useQuery({
    queryKey: keys.serials.incomeHistory(shopId ?? ""),
    queryFn: () => getIncomeHistory(shopId!),
    enabled: !!shopId,
  });

  const manualQuery = useQuery({
    queryKey: keys.manualEntries.byShop(shopId ?? ""),
    queryFn: () => getManualEntries(shopId!),
    enabled: !!shopId,
  });

  const servicesQuery = useQuery({
    queryKey: keys.services.byShop(shopId ?? ""),
    queryFn: () => getShopServicesForEntries(shopId!),
    enabled: !!shopId,
  });

  const chairsQuery = useQuery({
    queryKey: keys.chairs.byShop(shopId ?? ""),
    queryFn: () => getShopChairsForEntries(shopId!),
    enabled: !!shopId,
  });

  const earnings: StaffEarning[] = useMemo(() => {
    if (!serialsQuery.data || !chairsQuery.data) return [];
    const now = new Date(nowMs);
    const from =
      period === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getFullYear(), 0, 1);
    const to =
      period === "month"
        ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
        : new Date(now.getFullYear() + 1, 0, 1);

    const nameById = new Map((servicesQuery.data ?? []).map((s) => [s.id, s.name]));
    const manualRows = toManualEntryRows(manualQuery.data ?? [], nameById);

    return computeStaffEarnings(serialsQuery.data, manualRows, chairsQuery.data, from, to);
  }, [serialsQuery.data, manualQuery.data, servicesQuery.data, chairsQuery.data, period, nowMs]);

  return {
    earnings,
    chairs: chairsQuery.data ?? [],
    isPending: serialsQuery.isPending || chairsQuery.isPending,
  };
}
