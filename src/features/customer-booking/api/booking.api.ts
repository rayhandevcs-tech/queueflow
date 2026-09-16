import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import { joinQueue } from "@/lib/queue-join";
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

/**
 * The signed-in customer's own active serials.
 *
 * At most one *booking*, but a booking can be a party of up to five, so this
 * returns rows ordered by party position — index 0 is the solo serial or the
 * party lead. `maybeSingle()` would now throw on a legitimate family booking.
 */
export async function getMyActiveSerials(): Promise<Serial[]> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("serials")
    .select("*")
    .eq("customer_id", user.id)
    .in("status", [...ACTIVE_STATUSES])
    .order("party_seq", { ascending: true, nullsFirst: true });

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
  /**
   * Minutes from the customer to the shop, from the location Explore already
   * obtained. null → no "leave now" nudge for this booking, which is the right
   * outcome when we don't actually know where they are.
   */
  travelMin?: number | null;
}

/**
 * Book a serial. Chair/position/snapshot/amount are computed by the same
 * BEFORE INSERT trigger the provider's walk-in flow uses (chair_id passthrough
 * mirrors WalkInPayload in provider-queue). The DB rejects a second active
 * booking (one_active_serial_per_customer) or a closed shop.
 *
 * The insert itself moved to `@/lib/queue-join` in AI Sprint 3, when the AI's
 * confirm endpoint became a second caller. Same row, same trigger, same
 * policies — the only difference between the two callers is which Supabase
 * client they hold, and keeping the payload in one place is what stops the two
 * paths drifting into two subtly different kinds of booking.
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

    const { data, error } = await joinQueue(supabase, {
      shopId,
      serviceIds,
      customerId: user.id,
      customerName: (user.user_metadata?.full_name as string | undefined) ?? "",
      chairId: opts?.chairId,
      travelMin: opts?.travelMin,
      advance: opts?.advance,
    });

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
    .select(
      "id, serial_id, rating, comment, images, chair_id, created_at, owner_reply, owner_replied_at",
    )
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

/** One person in a party booking. `serviceIds` is per-member — they rarely all want the same thing. */
export interface PartyMember {
  name: string;
  serviceIds: string[];
}

/**
 * Book for two to five people at once.
 *
 * A single RPC rather than N inserts from here: a party half-created by a
 * dropped connection would leave the customer holding an active booking they
 * never asked for, and the one-active-booking rule would then block them from
 * fixing it. Returns the new group_id.
 */
export async function createGroupBooking(
  shopId: string,
  members: PartyMember[],
  opts?: { chairId?: string | null; travelMin?: number | null },
): Promise<string> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("create_group_booking", {
      p_shop_id: shopId,
      p_members: members.map((m) => ({
        name: m.name.trim(),
        service_ids: m.serviceIds,
      })),
      p_chair_id: opts?.chairId ?? null,
      p_travel_min: opts?.travelMin ?? null,
    });

    if (error) throw error;
    return data;
  });
}

/** Cancels every still-waiting member of a party — "we're not coming at all". */
export async function cancelMyGroup(groupId: string): Promise<number> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc("cancel_my_group", { p_group_id: groupId });
    if (error) throw error;
    return data ?? 0;
  });
}

/**
 * "I'm here." Goes through an RPC because the customer's own UPDATE policy on
 * `serials` only permits a write that lands on status = 'CANCELLED' — there is
 * deliberately no route for them to set columns directly.
 */
export async function markArrived(serialId: string): Promise<void> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const { error } = await supabase.rpc("mark_serial_arrived", { p_serial_id: serialId });
    if (error) throw error;
  });
}

// ---------------------------------------------------------------------------
// Style options for the services a customer has picked (20260929)
// ---------------------------------------------------------------------------

export interface ServiceStyleOption {
  service_id: string;
  hairstyle_id: string;
  sort_order: number;
  name_bn: string;
  name_en: string;
  reference_image_url: string | null;
}

/**
 * The styles this shop offers for these services, in the shop's own order.
 *
 * Shop-specific by construction: `service_styles` rows belong to a service,
 * and a service belongs to one shop, so asking for shop A's service ids can
 * only ever return shop A's offerings. There is nothing to filter and nothing
 * to get wrong.
 *
 * Returns `[]` for a service with no styles configured, which is the normal
 * case for every service that existed before this feature — the caller treats
 * an empty list as "do not ask", never as an error.
 */
export async function getServiceStyleOptions(
  serviceIds: string[],
): Promise<ServiceStyleOption[]> {
  if (serviceIds.length === 0) return [];

  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("service_styles")
    .select("service_id, hairstyle_id, sort_order, hairstyles(name_bn, name_en, reference_image_url)")
    .in("service_id", serviceIds)
    .order("sort_order");

  if (error) throw error;

  type Joined = {
    service_id: string;
    hairstyle_id: string;
    sort_order: number;
    hairstyles: { name_bn: string; name_en: string; reference_image_url: string | null } | null;
  };

  return ((data ?? []) as unknown as Joined[])
    // A row whose catalogue entry has gone is dropped rather than rendered
    // nameless. It cannot normally happen — the delete cascades — but the
    // alternative is a blank chip nobody can choose.
    .filter((row) => row.hairstyles !== null)
    .map((row) => ({
      service_id: row.service_id,
      hairstyle_id: row.hairstyle_id,
      sort_order: row.sort_order,
      name_bn: row.hairstyles!.name_bn,
      name_en: row.hairstyles!.name_en,
      reference_image_url: row.hairstyles!.reference_image_url,
    }));
}

/**
 * Record the style a customer asked for, against the serial they just took.
 *
 * Separate from `createBooking` on purpose. The booking is the thing that must
 * not fail; a preference is a nicety on top of it. If this write is refused,
 * the customer still has their place in the queue — see the caller, which
 * swallows the error deliberately rather than rolling anything back.
 *
 * The name snapshot is not sent: a trigger fills it from the catalogue, so the
 * stored name can never disagree with the stored id.
 */
export async function saveSerialStyle(serialId: string, hairstyleId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from("serial_style_preferences")
    .upsert({ serial_id: serialId, hairstyle_id: hairstyleId }, { onConflict: "serial_id" });

  if (error) throw error;
}
