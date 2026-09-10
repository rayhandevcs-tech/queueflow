import { getBrowserClient } from "@/lib/supabase/client";

/**
 * The shop's accepted payment methods.
 *
 * The third local copy of this four-line query — `provider-queue` and
 * `provider-appointments` each have one — because features may not import
 * each other and the alternative is hoisting a Supabase query into `shared`,
 * where nothing else that touches a table lives. The duplication is the
 * cheaper half of that trade, and the same one Sprint 18 made.
 *
 * Falls back to `["cash"]` both while loading and for a row that predates the
 * `accepted_payment_methods` column, so the sheet never shows zero options.
 */
export async function getShopAcceptedPaymentMethods(shopId: string): Promise<string[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .select("accepted_payment_methods")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw error;
  return data?.accepted_payment_methods ?? ["cash"];
}
