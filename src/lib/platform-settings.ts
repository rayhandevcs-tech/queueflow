"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrowserClient } from "@/lib/supabase/client";
import { keys } from "@/lib/query/keys";

/**
 * The platform's default loyalty earning rate (20260928).
 *
 * This lives in `src/lib` rather than in a feature because two features need
 * it and a feature may not import another (eslint boundaries): the admin panel
 * edits it, and the provider's own loyalty form shows it as the number a new
 * programme starts from. One reader, one cache entry, one answer.
 *
 * ---------------------------------------------------------------------------
 * What this number is NOT
 * ---------------------------------------------------------------------------
 * It is not what any shop earns at. Each shop owns
 * `loyalty_settings.taka_per_point` and can set it to whatever it likes. This
 * is only the starting point, which is why an admin moving it cannot change a
 * live programme, and cannot change a single row of `loyalty_transactions` —
 * that ledger is append-only and points already awarded were awarded under
 * whatever rule was in force at the time (the rate is recorded on each row).
 *
 * The database enforces the same split: the column default was dropped and a
 * trigger fills an omitted `taka_per_point` from here, so the platform value
 * decides what a NEW row gets and nothing decides for an existing one.
 */

/**
 * The value the database has always used, and what the fill trigger falls back
 * to if the singleton row is ever missing. Kept as a named constant so a read
 * failure renders a plausible number rather than `0` — "৳0 = 1 point" is a
 * sentence about the product, not about the network.
 */
export const PLATFORM_LOYALTY_FALLBACK = 100;

export async function getPlatformLoyaltyDefault(): Promise<number> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("loyalty_taka_per_point")
    .maybeSingle();

  if (error) throw error;
  // `maybeSingle`, not `single`: one row is guaranteed by the schema, but "no
  // row" should degrade to the historical default rather than throw on a
  // screen whose job is to show a number.
  return data?.loyalty_taka_per_point ?? PLATFORM_LOYALTY_FALLBACK;
}

export function usePlatformLoyaltyDefault() {
  return useQuery({
    queryKey: keys.admin.platformLoyaltyDefault(),
    queryFn: getPlatformLoyaltyDefault,
    // It changes about once a year. Refetching it on every mount would be
    // noise, and a stale read here is harmless: the authoritative copy is the
    // one the database applies in the trigger, not the one on screen.
    staleTime: 5 * 60 * 1000,
  });
}
