import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  buildShopBrief,
  type ProgrammeBrief,
  type ShopBrief,
} from "../lib/build-shop-brief";

/** Nobody is signed in, or the signed-in account owns no shop. */
export const NO_SHOP = "NO_SHOP";

/**
 * A rolling six months. Long enough to see a seasonal swing and a trend across
 * several months; short enough that the brief stays small, which matters
 * because it is re-sent (and cached) on every chat turn.
 */
function since(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Today's date **in Dhaka**, as "YYYY-MM-DD".
 *
 * This runs on a server whose clock is UTC, and the analytics RPCs take
 * calendar days which they resolve in Asia/Dhaka. Without the shift, between
 * 18:00 and 24:00 UTC the server's "today" is yesterday in Dhaka and the
 * brief would stop a day short of the work the owner just finished.
 *
 * The +6 is the project's existing documented convention — the same offset
 * `at time zone 'Asia/Dhaka'` applies in every migration — not a new timezone
 * model. Bangladesh has observed no DST since 2010, so a fixed offset is the
 * whole truth here.
 */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

function dhakaDay(at: Date): string {
  return new Date(at.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Read the caller's own shop and reduce it to a brief.
 *
 * Everything here goes through the cookie-bound Supabase client, so RLS is what
 * enforces ownership — not a `where owner_id = ...` we could forget. The
 * service-role client is deliberately not used: this runs on behalf of one
 * shopkeeper looking at their own numbers, and there is no reason to hand that
 * request a key that can read every shop on the platform.
 */
export async function gatherShopBrief(): Promise<ShopBrief> {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(NO_SHOP);

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, business_type")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!shop) throw new Error(NO_SHOP);

  const from = since();

  const [serials, manualEntries, expenses, reviews, chairs, services] = await Promise.all([
    supabase
      .from("serials")
      .select(
        "completed_at, created_at, total_amount, payment_status, status, chair_id, customer_id, services_snapshot",
      )
      .eq("shop_id", shop.id)
      .gte("created_at", from),
    supabase
      .from("manual_entries")
      .select("created_at, amount, payment_status")
      .eq("shop_id", shop.id)
      .gte("created_at", from),
    supabase
      .from("shop_expenses")
      .select("spent_on, amount, category")
      .eq("shop_id", shop.id)
      .gte("spent_on", from.slice(0, 10)),
    supabase
      .from("reviews")
      .select("rating, comment, created_at")
      .eq("shop_id", shop.id)
      .is("hidden_at", null)
      .gte("created_at", from),
    supabase.from("chairs").select("id, label, staff_name, is_active").eq("shop_id", shop.id),
    supabase
      .from("services")
      .select("name, rate, default_duration_min, is_active")
      .eq("shop_id", shop.id),
  ]);

  return buildShopBrief({
    shopName: shop.name,
    businessType: shop.business_type,
    serials: serials.data ?? [],
    manualEntries: manualEntries.data ?? [],
    expenses: expenses.data ?? [],
    reviews: reviews.data ?? [],
    chairs: chairs.data ?? [],
    services: services.data ?? [],
    programmes: await gatherProgrammes(supabase, shop.id, from.slice(0, 10)),
  });
}

/**
 * The Sprint 10 aggregates, over the same six-month window.
 *
 * Read through the **analytics RPCs**, not by pulling appointment, ledger,
 * membership, referral and redemption rows into Node and adding them up here.
 * That is the plan's instruction ("the brief should be based on
 * already-computed analytics") and it is also the only version that stays
 * correct: these are the same functions the dashboard calls, so the assistant
 * cannot quote a no-show rate the owner's own screen disagrees with.
 *
 * Still the cookie-bound client, so every one of them is checked against
 * `is_shop_owner` inside `analytics_scope` — the service-role key is
 * deliberately not used here, for the same reason as the rest of this file.
 *
 * **A failure returns null rather than throwing.** The analytics migration is
 * applied by hand, so until it has been run in a given environment these
 * functions do not exist; the AI assistant is not allowed to break because an
 * optional block of numbers could not be fetched. The brief then simply says
 * `programmes: null`, and the prompt's rule — never claim what is not in the
 * brief — covers the rest.
 */
async function gatherProgrammes(
  supabase: SupabaseClient<Database>,
  shopId: string,
  from: string,
): Promise<ProgrammeBrief | null> {
  const to = dhakaDay(new Date());
  const args = { p_shop_id: shopId, p_from: from, p_to: to };

  try {
    const [appointments, queue, loyalty, membership, referral, rewards] = await Promise.all([
      supabase.rpc("shop_appointment_stats", args),
      supabase.rpc("shop_queue_stats", args),
      supabase.rpc("shop_loyalty_stats", args),
      supabase.rpc("shop_membership_stats", args),
      supabase.rpc("shop_referral_summary", args),
      supabase.rpc("shop_reward_stats", args),
    ]);

    // Every one erroring means the migration is missing or the caller does not
    // own this shop; either way there is nothing honest to report.
    if (
      appointments.error &&
      queue.error &&
      loyalty.error &&
      membership.error &&
      referral.error &&
      rewards.error
    ) {
      return null;
    }

    const ap = appointments.data?.[0] ?? null;
    const qs = queue.data?.[0] ?? null;
    const ly = loyalty.data?.[0] ?? null;
    const mb = membership.data?.[0] ?? null;
    const rf = referral.data?.[0] ?? null;
    const rw = rewards.data?.[0] ?? null;

    return {
      window: { from, to },
      appointments: ap
        ? {
            total: ap.total,
            completed: ap.completed,
            cancelled: ap.cancelled,
            noShow: ap.no_show,
            upcoming: ap.booked + ap.confirmed + ap.in_progress,
            completionRate: ap.completion_rate,
            noShowRate: ap.no_show_rate,
            cancelRate: ap.cancel_rate,
            avgScheduledMin: ap.avg_scheduled_min,
            avgLeadDays: ap.avg_lead_days,
          }
        : null,
      queue: qs
        ? {
            total: qs.total,
            completed: qs.completed,
            cancelled: qs.cancelled,
            noShow: qs.no_show,
            completionRate: qs.completion_rate,
            avgServiceMin: qs.avg_service_min,
            avgWaitMin: qs.avg_wait_min,
          }
        : null,
      loyalty: ly
        ? {
            enabled: ly.is_enabled,
            accounts: ly.accounts,
            outstandingPoints: ly.outstanding_points,
            earnedPoints: ly.earned_points,
            redeemedPoints: ly.redeemed_points,
            referralPoints: ly.referral_points,
            transactions: ly.transactions,
          }
        : null,
      membership: mb
        ? {
            tiersActive: mb.tiers_active,
            activeMembers: mb.active_members,
            pendingMembers: mb.pending_members,
            expiredMembers: mb.expired_members,
            expiringSoon: mb.expiring_soon,
            newInWindow: mb.new_in_range,
            revenueCollected: mb.revenue_collected,
            revenueDue: mb.revenue_due,
          }
        : null,
      referral: rf
        ? {
            enabled: rf.is_enabled,
            total: rf.referrals_total,
            pending: rf.referrals_pending,
            converted: rf.referrals_converted,
            conversionRate: rf.conversion_rate,
            customersBrought: rf.customers_brought,
            pointsAwarded: rf.points_awarded,
          }
        : null,
      rewards: rw
        ? {
            total: rw.rewards_total,
            active: rw.rewards_active,
            redemptionsIssued: rw.redemptions_issued,
            redemptionsUsed: rw.redemptions_used,
            redemptionsExpired: rw.redemptions_expired,
            useRate: rw.use_rate,
            pointsSpent: rw.points_spent,
            discountGiven: rw.discount_given,
          }
        : null,
    };
  } catch {
    return null;
  }
}
