import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { Message } from "@/types";

export async function getThreadMessages(shopId: string, customerId: string): Promise<Message[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Wrapped in withDbErrors because ChatThreadView toasts `err.message` raw: a
 * DB-level rejection (today that's the blocked-account trigger from Sprint 26)
 * has to arrive already translated, not as a Postgres string.
 */
export async function sendMessage(params: {
  shopId: string;
  customerId: string;
  senderId: string;
  content?: string;
  imageUrls?: string[];
}): Promise<Message> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    // A single image keeps using the legacy `image_url` column (already live,
    // no migration needed) — only 2+ images need the new `image_urls` array,
    // which doesn't exist until 20260816_chat_multi_image.sql is applied.
    // Neither key is present in the payload unless actually needed, same
    // "safe optional column" discipline as Sprint 15's services.image_url fix.
    const urls = params.imageUrls ?? [];
    const { data, error } = await supabase
      .from("messages")
      .insert({
        shop_id: params.shopId,
        customer_id: params.customerId,
        sender_id: params.senderId,
        content: params.content?.trim() || null,
        ...(urls.length === 1 ? { image_url: urls[0] } : {}),
        ...(urls.length > 1 ? { image_urls: urls } : {}),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}

/** Marks every message the given reader didn't send as read (best-effort). */
export async function markThreadRead(
  shopId: string,
  customerId: string,
  readerId: string,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .eq("is_read", false)
    .neq("sender_id", readerId);

  if (error) throw error;
}

/**
 * Minimal shop lookup for the customer-side chat header — kept local
 * instead of importing customer-booking's useShopDetail, since features
 * may not depend on each other (see eslint boundaries config).
 */
export async function getShopBasics(shopId: string): Promise<{ id: string; name: string } | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .select("id, name")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * The signed-in provider's own shop id — kept local instead of importing
 * provider-catalog's useMyShop, for the same cross-feature-boundary reason.
 */
export async function getMyShopId(): Promise<string | null> {
  const supabase = getBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

/** All messages the signed-in customer has ever sent/received, newest first. */
export async function getMyThreadMessages(customerId: string): Promise<Message[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/** All messages ever exchanged at this shop (any customer), newest first. */
export async function getShopThreadMessages(shopId: string): Promise<Message[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/** Batch shop lookup for the customer-side chat list. */
export async function getShopsBasics(
  shopIds: string[],
): Promise<Record<string, { name: string; logo_url: string | null }>> {
  if (shopIds.length === 0) return {};
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .select("id, name, logo_url")
    .in("id", shopIds);

  if (error) throw error;
  const byId: Record<string, { name: string; logo_url: string | null }> = {};
  for (const row of data) byId[row.id] = { name: row.name, logo_url: row.logo_url };
  return byId;
}

/**
 * Batch customer-name lookup for the provider-side chat list — same
 * customer_name-snapshot-on-serials trick as getCustomerDisplayName, but
 * one query for every customer at this shop instead of one per customer.
 */
export async function getCustomerNamesForShop(
  shopId: string,
): Promise<Record<string, string>> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serials")
    .select("customer_id, customer_name, created_at")
    .eq("shop_id", shopId)
    .not("customer_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const byId: Record<string, string> = {};
  for (const row of data) {
    if (row.customer_id && !(row.customer_id in byId)) byId[row.customer_id] = row.customer_name;
  }
  return byId;
}

/** Lightweight unread count for the customer's nav badge — no row bodies fetched. */
export async function getMyUnreadChatCount(customerId: string): Promise<number> {
  const supabase = getBrowserClient();
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("is_read", false)
    .neq("sender_id", customerId);

  if (error) throw error;
  return count ?? 0;
}

/** Lightweight unread count for the provider's nav badge. */
export async function getShopUnreadChatCount(shopId: string, ownerId: string): Promise<number> {
  const supabase = getBrowserClient();
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("is_read", false)
    .neq("sender_id", ownerId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Provider-side chat header needs the customer's name, but there's no
 * general "read another user's profile" access — reuse the customer_name
 * snapshot already on their most recent serial at this shop instead, which
 * the owner can already read.
 */
export async function getCustomerDisplayName(
  shopId: string,
  customerId: string,
): Promise<string | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("serials")
    .select("customer_name")
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.customer_name ?? null;
}
