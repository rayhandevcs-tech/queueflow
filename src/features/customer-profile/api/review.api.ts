import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { Review } from "@/types";
import { translate } from "@/lib/i18n";
import { customerProfileDict } from "../lib/i18n";

export async function submitReview(payload: {
  shopId: string;
  serialId: string;
  rating: number;
  comment: string;
  images?: string[];
}): Promise<Review> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error(translate(customerProfileDict, "notLoggedIn"));

    // Auto-tag which staff/chair served this booking, straight from the serial —
    // the customer never has to pick a name themselves.
    const { data: serial } = await supabase
      .from("serials")
      .select("chair_id")
      .eq("id", payload.serialId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        shop_id: payload.shopId,
        serial_id: payload.serialId,
        customer_id: user.id,
        rating: payload.rating,
        comment: payload.comment.trim() || null,
        images: payload.images ?? [],
        chair_id: serial?.chair_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}
