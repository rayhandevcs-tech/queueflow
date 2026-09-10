"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  activateMembership,
  cancelMembership,
  enrollMember,
  getMembershipSummary,
  getMyMemberships,
  getShopCustomers,
  getShopMemberships,
  getShopsByIds,
  markMembershipPaid,
  requestMembership,
} from "../api/memberships.api";

/**
 * Membership reads and writes.
 *
 * No realtime channel, on purpose. `customer_memberships` is not in the
 * realtime publication, so a subscription would be a silent no-op that also
 * demanded a Supabase dashboard step — the same call made for `appointments`
 * in Sprint 5.1. Membership also changes a handful of times a week, not a
 * handful of times an hour, so invalidation after each mutation is the whole
 * requirement.
 */

/** The owner's members list. */
export function useShopMemberships(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.membership.byShop(shopId ?? ""),
    queryFn: () => getShopMemberships(shopId!),
    enabled: !!shopId,
  });
}

/** The four tiles above the owner's list. */
export function useMembershipSummary(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.membership.summary(shopId ?? ""),
    queryFn: () => getMembershipSummary(shopId!),
    enabled: !!shopId,
  });
}

/** Past customers of this shop, for the counter-enrolment picker. */
export function useShopCustomers(shopId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.membership.shopCustomers(shopId ?? ""),
    queryFn: () => getShopCustomers(shopId!),
    // Only fetched when the sheet is actually open: it reads the shop's whole
    // work history, which is not worth doing to render a page nobody clicked.
    enabled: !!shopId && enabled,
    staleTime: 5 * 60_000,
  });
}

/** The signed-in customer's memberships, across shops. */
export function useMyMemberships() {
  return useQuery({
    queryKey: keys.membership.mine(),
    queryFn: getMyMemberships,
    staleTime: 60_000,
  });
}

/**
 * The shops those memberships belong to, so each card can name and picture
 * one. Keyed by the sorted id list, so it re-fetches only when the set of
 * shops actually changes.
 */
export function useMembershipShops(shopIds: string[]) {
  return useQuery({
    queryKey: keys.membership.shops(shopIds),
    queryFn: () => getShopsByIds(shopIds),
    enabled: shopIds.length > 0,
    staleTime: 5 * 60_000,
  });
}

/**
 * The owner's writes.
 *
 * Every one invalidates rather than patching the cache: activation changes
 * the row *and* three of the four summary tiles, and a hand-written patch
 * that got one of them wrong would be a number an owner trusts and shouldn't.
 */
export function useMembershipActions(shopId: string) {
  const queryClient = useQueryClient();

  const refresh = () => {
    for (const queryKey of [
      keys.membership.byShop(shopId),
      keys.membership.summary(shopId),
      keys.membership.mine(),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const activate = useMutation({
    mutationFn: ({
      membershipId,
      payment,
    }: {
      membershipId: string;
      payment: { method: string } | { due: true };
    }) => activateMembership(membershipId, payment),
    onSettled: refresh,
  });

  const markPaid = useMutation({
    mutationFn: ({ membershipId, method }: { membershipId: string; method: string }) =>
      markMembershipPaid(membershipId, method),
    onSettled: refresh,
  });

  const cancel = useMutation({
    mutationFn: ({ membershipId, reason }: { membershipId: string; reason?: string }) =>
      cancelMembership(membershipId, reason),
    onSettled: refresh,
  });

  const enroll = useMutation({
    mutationFn: (input: {
      customerId: string;
      tierId: string;
      payment: { method: string } | { due: true };
      note?: string | null;
    }) => enrollMember({ shopId, ...input }),
    onSettled: refresh,
  });

  return { activate, markPaid, cancel, enroll };
}

/**
 * The customer's two writes: ask to join, and leave.
 *
 * There is no "pay" here because there is nothing to pay with — the app's
 * gateway is a mock, so the money is handed over at the shop and the owner
 * records it. `requestMembership` deliberately does not pre-check for an
 * existing membership; the unique index answers that, and answering it twice
 * would just be a slower way to be wrong under a race.
 */
export function useMyMembershipActions() {
  const queryClient = useQueryClient();

  const refresh = (shopId?: string) => {
    void queryClient.invalidateQueries({ queryKey: keys.membership.mine() });
    if (shopId) {
      void queryClient.invalidateQueries({ queryKey: keys.membership.byShop(shopId) });
      void queryClient.invalidateQueries({ queryKey: keys.membership.summary(shopId) });
    }
  };

  const join = useMutation({
    mutationFn: ({ shopId, tierId }: { shopId: string; tierId: string }) =>
      requestMembership(shopId, tierId),
    onSettled: (_data, _err, vars) => refresh(vars.shopId),
  });

  const leave = useMutation({
    mutationFn: ({ membershipId }: { membershipId: string; shopId?: string }) =>
      cancelMembership(membershipId),
    onSettled: (_data, _err, vars) => refresh(vars.shopId),
  });

  return { join, leave };
}
