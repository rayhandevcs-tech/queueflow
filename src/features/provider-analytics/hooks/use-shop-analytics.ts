"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  getAppointmentStats,
  getBreakdown,
  getLoyaltyStats,
  getMembershipStats,
  getOverviewStats,
  getPeakSlots,
  getQueueStats,
  getReferralStats,
  getRevenueTrend,
  getRewardStats,
  getStaffStats,
  type BreakdownDimension,
} from "../api/shop-analytics.api";
import { isValidRange, rangeKey, trendBucket, type DateRange } from "../lib/date-range";

/**
 * One hook per analytics section.
 *
 * Separate queries rather than one giant one, on purpose: each section then
 * has its own loading, empty and error state, and a shop with a broken
 * membership read still shows its revenue. They all fire in parallel on mount,
 * so the page costs one round trip's worth of time, not eleven.
 *
 * **Every key is shop + range.** `enabled` also refuses to fire for a range
 * the server would reject, so a half-typed custom date does not turn into a
 * failed request and a red error box while the owner is still typing.
 *
 * No realtime subscription. The existing hourly/weekly card on this page has
 * one because it is a live picture of today's queue; a dashboard covering
 * "last 30 days" does not change meaningfully between two taps, and a channel
 * per section would be eleven subscriptions for numbers nobody is watching
 * move. `staleTime` does the work instead — switching from 7 days back to 30
 * is instant because the earlier answer is still good.
 */

/**
 * Two minutes. Long enough that flipping between ranges and back is free,
 * short enough that an owner who just closed a job and came to look sees it.
 */
const STALE_MS = 2 * 60_000;

function common(shopId: string | undefined, range: DateRange) {
  return {
    enabled: !!shopId && isValidRange(range),
    staleTime: STALE_MS,
  };
}

export function useOverviewStats(shopId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keys.analytics.overview(shopId ?? "", rangeKey(range)),
    queryFn: () => getOverviewStats(shopId!, range),
    ...common(shopId, range),
  });
}

export function useRevenueTrend(shopId: string | undefined, range: DateRange) {
  const bucket = trendBucket(range);
  return useQuery({
    queryKey: keys.analytics.trend(shopId ?? "", rangeKey(range), bucket),
    queryFn: () => getRevenueTrend(shopId!, range, bucket),
    ...common(shopId, range),
  });
}

export function useAppointmentStats(shopId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keys.analytics.appointments(shopId ?? "", rangeKey(range)),
    queryFn: () => getAppointmentStats(shopId!, range),
    ...common(shopId, range),
  });
}

export function useQueueStats(shopId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keys.analytics.queue(shopId ?? "", rangeKey(range)),
    queryFn: () => getQueueStats(shopId!, range),
    ...common(shopId, range),
  });
}

export function useStaffStats(shopId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keys.analytics.staff(shopId ?? "", rangeKey(range)),
    queryFn: () => getStaffStats(shopId!, range),
    ...common(shopId, range),
  });
}

export function usePeakSlots(shopId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keys.analytics.peak(shopId ?? "", rangeKey(range)),
    queryFn: () => getPeakSlots(shopId!, range),
    ...common(shopId, range),
  });
}

export function useLoyaltyStats(shopId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keys.analytics.loyalty(shopId ?? "", rangeKey(range)),
    queryFn: () => getLoyaltyStats(shopId!, range),
    ...common(shopId, range),
  });
}

export function useMembershipStats(shopId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keys.analytics.membership(shopId ?? "", rangeKey(range)),
    queryFn: () => getMembershipStats(shopId!, range),
    ...common(shopId, range),
  });
}

export function useReferralStats(shopId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keys.analytics.referral(shopId ?? "", rangeKey(range)),
    queryFn: () => getReferralStats(shopId!, range),
    ...common(shopId, range),
  });
}

export function useRewardStats(shopId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keys.analytics.rewards(shopId ?? "", rangeKey(range)),
    queryFn: () => getRewardStats(shopId!, range),
    ...common(shopId, range),
  });
}

export function useBreakdown(
  shopId: string | undefined,
  range: DateRange,
  dimension: BreakdownDimension,
) {
  return useQuery({
    queryKey: keys.analytics.breakdown(shopId ?? "", rangeKey(range), dimension),
    queryFn: () => getBreakdown(shopId!, range, dimension),
    ...common(shopId, range),
  });
}
