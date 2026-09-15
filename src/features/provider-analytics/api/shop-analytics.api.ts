import { getBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import type { DateRange } from "../lib/date-range";
import type {
  BreakdownRow,
  PeakSlot,
  StaffStatRow,
  TrendPoint,
} from "../lib/compute-dashboard";

/**
 * Reads for the analytics dashboard.
 *
 * Eleven aggregate RPCs and **not one table read**. That is the performance
 * decision and the security decision at once:
 *
 * · Performance — a month of a busy shop is thousands of serials,
 *   appointments, ledger rows and redemptions. Summing them in Postgres and
 *   sending back one row of numbers is a few hundred bytes; sending the rows
 *   and summing them in React is megabytes over a phone connection, and it is
 *   the same arithmetic done more slowly and in a second place where it can
 *   drift from the income page (decision 23 of Sprint 5.1, applied again).
 *
 * · Security — every function is SECURITY INVOKER and every one begins with
 *   `analytics_scope()`, which raises `not your shop` unless
 *   `is_shop_owner(p_shop_id)`. So `shopId` is checked by the database on
 *   every call, and a caller who passes somebody else's id gets an error
 *   rather than their numbers. Nothing here trusts the id it was handed, and
 *   nothing here filters by shop in JavaScript.
 *
 * The date pair goes to the server as two inclusive calendar days and the
 * server decides what they mean in Asia/Dhaka. No client-side timestamp
 * arithmetic, so the dashboard and the SQL can never disagree about where a
 * day ends.
 *
 * An RPC that raises reaches here as a rejected promise, which TanStack Query
 * surfaces as `isError` — the sections render an error state rather than a
 * confident zero.
 */

type Fn = Database["public"]["Functions"];

export type OverviewStats = Fn["shop_overview_stats"]["Returns"][number];
export type AppointmentStats = Fn["shop_appointment_stats"]["Returns"][number];
export type QueueStats = Fn["shop_queue_stats"]["Returns"][number];
export type LoyaltyStats = Fn["shop_loyalty_stats"]["Returns"][number];
export type MembershipStats = Fn["shop_membership_stats"]["Returns"][number];
export type ReferralStats = Fn["shop_referral_summary"]["Returns"][number];
export type RewardStats = Fn["shop_reward_stats"]["Returns"][number];
export type BreakdownDimension = Fn["shop_analytics_breakdown"]["Args"]["p_dimension"];

// The pure layer declares its own row shapes so its tests need no codegen.
// These assignments are the seam: rename a column in SQL, regenerate the
// types, and the build fails here instead of the dashboard rendering blanks.
const _trendShape: TrendPoint = {} as Fn["shop_revenue_trend"]["Returns"][number];
const _slotShape: PeakSlot = {} as Fn["shop_peak_slots"]["Returns"][number];
const _staffShape: StaffStatRow = {} as Fn["shop_staff_stats"]["Returns"][number];
const _breakdownShape: BreakdownRow = {} as Fn["shop_analytics_breakdown"]["Returns"][number];
void _trendShape;
void _slotShape;
void _staffShape;
void _breakdownShape;

/**
 * Every RPC here returns `setof`, so a single-row aggregate arrives as an
 * array of one. `null` for an empty result rather than a hand-made row of
 * zeros: a shop that returned nothing has not told us its revenue is 0, and
 * the difference is the whole point of the N/A rule.
 */
function firstRow<T>(rows: T[] | null): T | null {
  return rows?.[0] ?? null;
}

export async function getOverviewStats(
  shopId: string,
  range: DateRange,
): Promise<OverviewStats | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_overview_stats", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return firstRow(data);
}

export async function getRevenueTrend(
  shopId: string,
  range: DateRange,
  bucket: "DAY" | "MONTH",
): Promise<TrendPoint[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_revenue_trend", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
    p_bucket: bucket,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getAppointmentStats(
  shopId: string,
  range: DateRange,
): Promise<AppointmentStats | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_appointment_stats", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return firstRow(data);
}

export async function getQueueStats(
  shopId: string,
  range: DateRange,
): Promise<QueueStats | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_queue_stats", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return firstRow(data);
}

export async function getStaffStats(
  shopId: string,
  range: DateRange,
): Promise<StaffStatRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_staff_stats", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getPeakSlots(shopId: string, range: DateRange): Promise<PeakSlot[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_peak_slots", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getLoyaltyStats(
  shopId: string,
  range: DateRange,
): Promise<LoyaltyStats | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_loyalty_stats", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return firstRow(data);
}

export async function getMembershipStats(
  shopId: string,
  range: DateRange,
): Promise<MembershipStats | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_membership_stats", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return firstRow(data);
}

export async function getReferralStats(
  shopId: string,
  range: DateRange,
): Promise<ReferralStats | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_referral_summary", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return firstRow(data);
}

export async function getRewardStats(
  shopId: string,
  range: DateRange,
): Promise<RewardStats | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_reward_stats", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw error;
  return firstRow(data);
}

export async function getBreakdown(
  shopId: string,
  range: DateRange,
  dimension: BreakdownDimension,
): Promise<BreakdownRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc("shop_analytics_breakdown", {
    p_shop_id: shopId,
    p_from: range.from,
    p_to: range.to,
    p_dimension: dimension,
  });
  if (error) throw error;
  return data ?? [];
}
