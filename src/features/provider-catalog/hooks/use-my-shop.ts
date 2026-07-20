"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import type { Shop, TablesUpdate } from "@/types";
import { createShop, getMyShop, updateShop } from "../api/shop.api";
import type { ShopFormOutput } from "../schemas/shop.schema";

export function useMyShop() {
  return useQuery({
    queryKey: keys.shops.mine(),
    queryFn: getMyShop,
  });
}

export function useShopMutations() {
  const queryClient = useQueryClient();

  const invalidate = (shop: Shop) => {
    queryClient.setQueryData(keys.shops.mine(), shop);
    void queryClient.invalidateQueries({ queryKey: keys.shops.detail(shop.id) });
    void queryClient.invalidateQueries({ queryKey: keys.shops.open() });
  };

  const create = useMutation({
    mutationFn: (values: ShopFormOutput) => createShop(values),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      shopId,
      patch,
    }: {
      shopId: string;
      patch: TablesUpdate<"shops">;
    }) => updateShop(shopId, patch),
    onSuccess: invalidate,
  });

  return { create, update };
}