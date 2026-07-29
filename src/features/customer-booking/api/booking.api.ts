import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import { ACTIVE_STATUSES } from "@/config/constants";
import type { ReviewRow } from "@/lib/reviews";
import type { Chair, ChairServiceStat, QueuePublicRow, Serial, Service, Shop, ShopGalleryImage } from "@/types";

export async function getShopDetail(shopId: string): Promise<Shop | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Gate for the "মেসেজ" entry point on the shop page — chat only opens once booked. */
export async function hasServiceHistoryAtShop(shopId: string): Promise<boolean> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { count, error } = await supabase
    .from("serials")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", user.id)
    .eq("shop_id", shopId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getShopServices(shopId: string): Promise<Service[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/** The signed-in customer's own active serial, anywhere — at most one (DB-enforced). */
export async function getMyActiveSerial(): Promise<Serial | null> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("serials")
    .select("*")
    .eq("customer_id", user.id)
    .in("status", [...ACTIVE_STATUSES])
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface AdvancePaymentInfo {
  method: "bkash" | "nagad";
  transactionId: string;
}

export interface CreateBookingOptions {
  advance?: AdvancePaymentInfo;
  /** Customer's optional preferred staff/chair — null/omitted → DB assign_best_chair auto-picks. */
  chairId?: string | null;
}

/**
 * Book a serial. Chair/position/snapshot/amount are computed by the same
 * BEFORE INSERT trigger the provider's walk-in flow uses (chair_id passthrough
 * mirrors WalkInPayload in provider-queue). The DB rejects a second active
 * booking (one_active_serial_per_customer) or a closed shop.
 */
export async function createBooking(
  shopId: string,
  serviceIds: string[],
  opts?: CreateBookingOptions,
): Promise<Serial> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");

    const fullName =
      (user.user_metadata?.full_name as string | undefined)?.trim() || "Customer";

    const { data, error } = await supabase
      .from("serials")
      .insert({
        shop_id: shopId,
        customer_id: user.id,
        customer_name: fullName,
        service_ids: serviceIds,
        is_walk_in: false,
        chair_id: opts?.chairId ?? null,
        ...(opts?.advance
          ? {
              advance_paid: true,
              advance_method: opts.advance.method,
              advance_txn_id: opts.advance.transactionId,
            }
          : {}),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/** Shop's photo gallery — public browsing, ordered for display. */
export async function getShopGallery(shopId: string): Promise<ShopGalleryImage[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shop_gallery_images")
    .select("*")
    .eq("shop_id", shopId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Reviews tab's public read — rating+comment only, never joined with
 * `serials` (that would leak other customers' identities/RLS-block).
 */
export async function getShopReviewsPublic(shopId: string): Promise<ReviewRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, serial_id, rating, comment, images, chair_id, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/** Per-staff average rating for the Staff tab's cards — public, same as shop_rating_summary. */
export async function getChairRatings(
  chairIds: string[],
): Promise<{ chair_id: string; avg_rating: number; review_count: number }[]> {
  if (chairIds.length === 0) return [];
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chair_rating_summary")
    .select("*")
    .in("chair_id", chairIds);

  if (error) throw error;
  return data;
}

/** Staff tab's chair list — active chairs only, public browsing. */
export async function getShopChairs(shopId: string): Promise<Chair[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chairs")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Which chairs can perform which of the given services — powers Staff tab's
 * "পারদর্শিতা" chips and the preferred-staff eligibility filter in the
 * booking flow (a chair is eligible only if it can perform every selected service).
 */
/**
 * All chair_service_stats rows for these services — including can_perform=false
 * ones. A chair with NO row at all is still eligible by default (mirrors the
 * provider's own CanPerformMatrix, which defaults an unset cell to allowed) —
 * so callers must treat "no row" as capable and only exclude explicit false rows.
 */
export async function getChairServiceCapabilities(
  serviceIds: string[],
): Promise<ChairServiceStat[]> {
  if (serviceIds.length === 0) return [];
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chair_service_stats")
    .select("*")
    .in("service_id", serviceIds);

  if (error) throw error;
  return data;
}

/** PII-free live queue rows for one shop — powers the "ahead of you" list. */
export async function getShopQueuePublic(shopId: string): Promise<QueuePublicRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("queue_public")
    .select("*")
    .eq("shop_id", shopId);

  if (error) throw error;
  return data;
}

export async function cancelMySerial(serialId: string): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase
      .from("serials")
      .update({ status: "CANCELLED" })
      .eq("id", serialId);

    if (error) throw error;
  });
}
