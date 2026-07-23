import { getBrowserClient } from "@/lib/supabase/client";
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

export async function sendMessage(params: {
  shopId: string;
  customerId: string;
  senderId: string;
  content: string;
}): Promise<Message> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      shop_id: params.shopId,
      customer_id: params.customerId,
      sender_id: params.senderId,
      content: params.content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
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
