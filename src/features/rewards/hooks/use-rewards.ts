"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  createReward,
  findRedemptionByCode,
  getMyBalanceAtShop,
  getMyCoupons,
  getOpenBookingsForCustomer,
  getPublicRewards,
  getShopRedemptions,
  getShopRewards,
  markRedemptionUsed,
  redeemReward,
  setRewardActive,
  updateReward,
} from "../api/rewards.api";
import type { RewardFormOutput } from "../schemas/reward.schema";

/**
 * Reward queries and mutations.
 *
 * No realtime channel, for the fifth sprint running and the same reason:
 * neither reward table is in the realtime publication, so a subscription
 * would be a silent no-op that also demanded a Supabase dashboard step. A
 * coupon moves when someone taps redeem or the owner checks a code — both
 * events the person is already looking at — so invalidation after each
 * mutation is the whole requirement.
 *
 * **Every key carries `shopId`.** A reward, a coupon and a points balance are
 * all shop-scoped, so a shared cache entry could offer one shop's reward
 * against another shop's points.
 */

export function useShopRewards(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.rewards.catalogue(shopId ?? ""),
    queryFn: () => getShopRewards(shopId!),
    enabled: !!shopId,
  });
}

export function usePublicRewards(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.rewards.publicCatalogue(shopId ?? ""),
    queryFn: () => getPublicRewards(shopId!),
    enabled: !!shopId,
  });
}

export function useShopRedemptions(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.rewards.redemptions(shopId ?? ""),
    queryFn: () => getShopRedemptions(shopId!),
    enabled: !!shopId,
  });
}

/**
 * This customer's balance at **this** shop.
 *
 * Never a total. Fifty points buys something at the shop that gave them and
 * nothing anywhere else (decision 33), so a merged figure would be an
 * actively misleading number to put next to a price.
 */
export function useMyBalanceAtShop(shopId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.rewards.myBalance(shopId ?? ""),
    queryFn: () => getMyBalanceAtShop(shopId!),
    enabled: !!shopId && enabled,
  });
}

export function useMyCoupons() {
  return useQuery({
    queryKey: keys.rewards.myCoupons(),
    queryFn: getMyCoupons,
    staleTime: 60_000,
  });
}

/** The customer's open jobs at this shop — only while the sheet is open. */
export function useOpenBookings(
  shopId: string | undefined,
  customerId: string | undefined,
) {
  return useQuery({
    queryKey: keys.rewards.openBookings(shopId ?? "", customerId ?? ""),
    queryFn: () => getOpenBookingsForCustomer(shopId!, customerId!),
    enabled: !!shopId && !!customerId,
  });
}

/** The owner's catalogue writes. */
export function useRewardActions(shopId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    for (const queryKey of [
      keys.rewards.catalogue(shopId),
      keys.rewards.publicCatalogue(shopId),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const create = useMutation({
    mutationFn: (values: RewardFormOutput) => createReward(shopId, values),
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: { rewardId: string; values: RewardFormOutput }) =>
      updateReward(input.rewardId, input.values),
    onSettled: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: (input: { rewardId: string; isActive: boolean }) =>
      setRewardActive(input.rewardId, input.isActive),
    onSettled: invalidate,
  });

  return { create, update, toggleActive };
}

/**
 * The owner's verification: look a code up, then consume it.
 *
 * Two steps on purpose. Looking up must not consume — the owner needs to see
 * whose coupon it is and what it is worth before choosing which bill it lands
 * on, and a lookup that burnt the coupon would be unusable at a counter.
 */
export function useRedemptionVerify(shopId: string) {
  const queryClient = useQueryClient();

  const lookUp = useMutation({
    mutationFn: (code: string) => findRedemptionByCode(shopId, code),
  });

  const consume = useMutation({
    mutationFn: (input: {
      code: string;
      bookingType: "SERIAL" | "APPOINTMENT";
      bookingId: string;
    }) => markRedemptionUsed({ shopId, ...input }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.rewards.redemptions(shopId) });
      // The customer is looking at this coupon too.
      void queryClient.invalidateQueries({ queryKey: keys.rewards.myCoupons() });
    },
  });

  return { lookUp, consume };
}

/**
 * The customer's one write: spend points on a reward.
 *
 * Invalidates the balance, the coupon list and the loyalty card list — the
 * points it just spent are a number the profile page is showing too, and
 * leaving that stale would make the app disagree with itself. The catalogue
 * goes too, because a limited reward's stock just fell.
 */
export function useRedeemReward(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId: string) => redeemReward(shopId, rewardId),
    onSettled: () => {
      for (const queryKey of [
        keys.rewards.myBalance(shopId),
        keys.rewards.myCoupons(),
        keys.rewards.publicCatalogue(shopId),
        keys.loyalty.myCards(),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
