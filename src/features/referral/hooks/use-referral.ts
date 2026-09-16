"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  claimReferral,
  getMyClaimedReferral,
  getMyReferralCode,
  getMyReferralShops,
  getMyReferrals,
  getShopReferralStats,
  mintMyReferralCode,
  saveReferralSettings,
} from "../api/referral.api";
import type { ReferralSettingsFormOutput } from "../schemas/referral-settings.schema";

/**
 * Referral queries and mutations.
 *
 * No realtime channel, for the fourth sprint running and the same reason:
 * neither referral table is in the realtime publication, so a subscription
 * would be a silent no-op that also demanded a Supabase dashboard step.
 * A referral converts when a job is finished — an event the owner is already
 * watching — so invalidation after each mutation is the whole requirement.
 *
 * **Every key carries `shopId`.** A code, a referral and a reward are all
 * shop-scoped, so a cache entry shared across shops would put one shop's
 * code on another shop's page.
 */

/**
 * The code this customer already holds here — never one that mints.
 *
 * `mintMyReferralCode` is a mutation and lives below, because the first call
 * writes a row. A query that created data as a side effect of rendering would
 * give a code to every customer who ever opened the tab.
 */
export function useMyReferralCode(shopId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.referral.myCode(shopId ?? ""),
    queryFn: () => getMyReferralCode(shopId!),
    enabled: !!shopId && enabled,
  });
}

/**
 * Every shop where this customer holds a code — the `/referral` page's list.
 *
 * Not shop-scoped, on purpose: this one IS the list across shops, the same
 * exception `keys.rewards.myCoupons()` makes for coupons. The per-shop keys
 * above stay per-shop.
 */
export function useMyReferralShops() {
  return useQuery({
    queryKey: keys.referral.myShops(),
    queryFn: getMyReferralShops,
  });
}

export function useMyReferrals(shopId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.referral.mine(shopId ?? ""),
    queryFn: () => getMyReferrals(shopId!),
    enabled: !!shopId && enabled,
  });
}

/** The referral this customer arrived on here, if they used a code. */
export function useMyClaimedReferral(shopId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.referral.claimed(shopId ?? ""),
    queryFn: () => getMyClaimedReferral(shopId!),
    enabled: !!shopId && enabled,
  });
}

export function useShopReferralStats(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.referral.stats(shopId ?? ""),
    queryFn: () => getShopReferralStats(shopId!),
    enabled: !!shopId,
  });
}

/** The owner's one write: the rules. */
export function useReferralSettingsActions(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ReferralSettingsFormOutput) => saveReferralSettings(shopId, values),
    onSuccess: (settings) => {
      // The row belongs to loyalty as much as to referral, so loyalty's own
      // cache entry is the one to refresh — not a second copy of it. "Is
      // referral live" is derived from this same row, so nothing else needs
      // invalidating.
      queryClient.setQueryData(keys.loyalty.settings(shopId), settings);
    },
  });
}

/**
 * The customer's two writes: ask for a code, and enter someone else's.
 *
 * Minting writes the code straight into its own cache entry, so the card
 * shows it without a second round trip. Claiming invalidates the claimed-row
 * query rather than writing it, because the server decides the referral's
 * shape and this is not the moment to guess it.
 */
export function useReferralActions(shopId: string) {
  const queryClient = useQueryClient();

  const mintCode = useMutation({
    mutationFn: () => mintMyReferralCode(shopId),
    onSuccess: (code) => {
      queryClient.setQueryData(keys.referral.myCode(shopId), code);
    },
  });

  const claim = useMutation({
    mutationFn: (code: string) => claimReferral(shopId, code),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.referral.claimed(shopId) });
    },
  });

  return { mintCode, claim };
}
