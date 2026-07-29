import { getBrowserClient } from "@/lib/supabase/client";
import type { Offer } from "@/types";

export type OfferWithShop = Offer & {
  shops: { id: string; name: string; cover_image_url: string | null } | null;
};

/** RLS already scopes this to active, unexpired offers at open shops. */
export async function getActiveOffers(): Promise<OfferWithShop[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*, shops(id, name, cover_image_url)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as OfferWithShop[];
}
