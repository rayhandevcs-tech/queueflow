import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import { ACTIVE_STATUSES } from "@/config/constants";
import type { QueuePublicRow, Serial, Service, Shop } from "@/types";

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

/**
 * Book a serial. Chair/position/snapshot/amount are computed by the same
 * BEFORE INSERT trigger the provider's walk-in flow uses. The DB rejects a
 * second active booking (one_active_serial_per_customer) or a closed shop.
 */
export async function createBooking(
  shopId: string,
  serviceIds: string[],
  advance?: AdvancePaymentInfo,
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
        ...(advance
          ? { advance_paid: true, advance_method: advance.method, advance_txn_id: advance.transactionId }
          : {}),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
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
