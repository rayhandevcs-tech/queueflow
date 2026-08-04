import { getBrowserClient } from "@/lib/supabase/client";
import type { Offer } from "@/types";
import type { OfferFormOutput } from "../schemas/offer.schema";

export async function getOffers(shopId: string): Promise<Offer[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createOffer(shopId: string, values: OfferFormOutput): Promise<Offer> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("offers")
    .insert({
      shop_id: shopId,
      title: values.title,
      description: values.description || null,
      discount_pct: values.discount_pct,
      valid_until: new Date(`${values.valid_until}T23:59:59`).toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Deactivate, never delete — keeps history of past offers intact. */
export async function setOfferActive(offerId: string, active: boolean): Promise<Offer> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("offers")
    .update({ active })
    .eq("id", offerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOffer(offerId: string, values: OfferFormOutput): Promise<Offer> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("offers")
    .update({
      title: values.title,
      description: values.description || null,
      discount_pct: values.discount_pct,
      valid_until: new Date(`${values.valid_until}T23:59:59`).toISOString(),
    })
    .eq("id", offerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Offers have no downstream reference (unlike services), so a real delete is safe. */
export async function deleteOffer(offerId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("offers").delete().eq("id", offerId);
  if (error) throw error;
}

/**
 * Best-effort: reuses the Sprint 2 broadcast RPC to tell regulars about a new
 * offer. The RPC enforces a 1-broadcast-per-shop-per-day limit shared with the
 * manual "নোটিফিকেশন পাঠান" feature, so a failure here (already broadcast
 * today) is swallowed — offer creation itself must never fail because of it.
 */
export async function notifyRegularsAboutOffer(shopId: string, offer: Offer): Promise<void> {
  const supabase = getBrowserClient();
  await supabase.rpc("broadcast_shop_notification", {
    p_shop_id: shopId,
    p_target: "regulars",
    p_title: `নতুন অফার: ${offer.title}`,
    p_body: `${offer.discount_pct}% ছাড় — এখনই দেখো!`,
  });
}
