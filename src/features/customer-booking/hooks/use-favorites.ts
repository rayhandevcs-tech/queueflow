"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { addFavorite, getMyFavoriteShopIds, removeFavorite } from "../api/favorites.api";

export function useMyFavoriteShopIds() {
  return useQuery({
    queryKey: keys.favorites.mine(),
    queryFn: getMyFavoriteShopIds,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shopId, isFavorited }: { shopId: string; isFavorited: boolean }) => {
      if (isFavorited) await removeFavorite(shopId);
      else await addFavorite(shopId);
    },
    onMutate: async ({ shopId, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: keys.favorites.mine() });
      const previous = queryClient.getQueryData<Set<string>>(keys.favorites.mine());
      const next = new Set(previous ?? []);
      if (isFavorited) next.delete(shopId);
      else next.add(shopId);
      queryClient.setQueryData(keys.favorites.mine(), next);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(keys.favorites.mine(), context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.favorites.mine() });
    },
  });
}
