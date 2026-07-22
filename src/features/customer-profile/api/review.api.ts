import { getBrowserClient } from "@/lib/supabase/client";
import { withDbErrors } from "@/lib/supabase/db-errors";
import type { Review } from "@/types";

export async function submitReview(payload: {
  shopId: string;
  serialId: string;
  rating: number;
  comment: string;
}): Promise<Review> {
  return withDbErrors(async () => {
    const supabase = getBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("লগইন করা নেই");

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        shop_id: payload.shopId,
        serial_id: payload.serialId,
        customer_id: user.id,
        rating: payload.rating,
        comment: payload.comment.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
}
