"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { upsertById } from "@/lib/query/realtime-cache";
import type { MembershipTier } from "@/types";
import {
  createTier,
  deleteTier,
  getPublicTiers,
  getTiers,
  seedPresetTiers,
  setTierActive,
  updateTier,
} from "../api/tiers.api";
import type { TierFormOutput } from "../schemas/tier.schema";

/** The owner's tier list — includes the ones they have switched off. */
export function useTiers(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.membership.tiers(shopId ?? ""),
    queryFn: () => getTiers(shopId!),
    enabled: !!shopId,
  });
}

/** What a customer sees on a shop's page: active tiers only. */
export function usePublicTiers(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.membership.publicTiers(shopId ?? ""),
    queryFn: () => getPublicTiers(shopId!),
    enabled: !!shopId,
    staleTime: 60_000,
  });
}

/**
 * Tier CRUD, following `useOfferMutations` deliberately — same optimistic
 * toggle with rollback, same `upsertById` cache write, same ordering
 * function passed to it. An owner who has used the offers page has already
 * learnt this screen.
 */
export function useTierMutations(shopId: string) {
  const queryClient = useQueryClient();
  const listKey = keys.membership.tiers(shopId);

  /** Both tier lists, plus the members list — a renamed tier shows there too. */
  const invalidateAll = () => {
    for (const queryKey of [
      listKey,
      keys.membership.publicTiers(shopId),
      keys.membership.byShop(shopId),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const order = (a: MembershipTier, b: MembershipTier) =>
    a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

  const create = useMutation({
    mutationFn: (values: TierFormOutput) => createTier(shopId, values),
    onSuccess: (tier) => {
      queryClient.setQueryData<MembershipTier[]>(listKey, (rows) =>
        upsertById(rows, tier, order),
      );
      void queryClient.invalidateQueries({ queryKey: keys.membership.publicTiers(shopId) });
    },
  });

  const update = useMutation({
    mutationFn: ({ tierId, values }: { tierId: string; values: TierFormOutput }) =>
      updateTier(tierId, values),
    onSuccess: (tier) => {
      queryClient.setQueryData<MembershipTier[]>(listKey, (rows) =>
        upsertById(rows, tier, order),
      );
      void queryClient.invalidateQueries({ queryKey: keys.membership.publicTiers(shopId) });
    },
  });

  const remove = useMutation({
    mutationFn: (tierId: string) => deleteTier(tierId),
    onSuccess: (_void, tierId) => {
      queryClient.setQueryData<MembershipTier[]>(
        listKey,
        (rows) => rows?.filter((t) => t.id !== tierId) ?? [],
      );
      void queryClient.invalidateQueries({ queryKey: keys.membership.publicTiers(shopId) });
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ tierId, isActive }: { tierId: string; isActive: boolean }) =>
      setTierActive(tierId, isActive),
    onMutate: async ({ tierId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<MembershipTier[]>(listKey);
      queryClient.setQueryData<MembershipTier[]>(
        listKey,
        (rows) => rows?.map((t) => (t.id === tierId ? { ...t, is_active: isActive } : t)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
    },
    onSettled: invalidateAll,
  });

  const seedPresets = useMutation({
    mutationFn: () => seedPresetTiers(shopId),
    onSuccess: invalidateAll,
  });

  return { create, update, remove, toggleActive, seedPresets };
}
