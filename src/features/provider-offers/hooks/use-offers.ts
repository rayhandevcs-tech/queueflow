"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { upsertById } from "@/lib/query/realtime-cache";
import type { Offer } from "@/types";
import {
  createOffer,
  getOffers,
  notifyRegularsAboutOffer,
  setOfferActive,
} from "../api/offers.api";
import type { OfferFormOutput } from "../schemas/offer.schema";

export function useOffers(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.offers.byShop(shopId ?? ""),
    queryFn: () => getOffers(shopId!),
    enabled: !!shopId,
  });
}

export function useOfferMutations(shopId: string) {
  const queryClient = useQueryClient();
  const listKey = keys.offers.byShop(shopId);

  const create = useMutation({
    mutationFn: (values: OfferFormOutput) => createOffer(shopId, values),
    onSuccess: async (offer) => {
      queryClient.setQueryData<Offer[]>(listKey, (rows) =>
        upsertById(rows, offer, (a, b) => b.created_at.localeCompare(a.created_at)),
      );
      try {
        await notifyRegularsAboutOffer(shopId, offer);
      } catch {
        // rate-limited or no regulars yet — offer itself is already saved
      }
    },
  });

  // optimistic toggle with rollback
  const toggleActive = useMutation({
    mutationFn: ({ offerId, active }: { offerId: string; active: boolean }) =>
      setOfferActive(offerId, active),
    onMutate: async ({ offerId, active }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Offer[]>(listKey);
      queryClient.setQueryData<Offer[]>(listKey, (rows) =>
        rows?.map((o) => (o.id === offerId ? { ...o, active } : o)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  return { create, toggleActive };
}
