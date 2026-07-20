"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import type { ChairServiceStat } from "@/types";
import { getChairStats, setCanPerform } from "../api/chair-stats.api";

export function useChairStats(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.chairStats.byShop(shopId ?? ""),
    queryFn: () => getChairStats(shopId!),
    enabled: !!shopId,
  });
}

export function useCanPerformMutation(shopId: string) {
  const queryClient = useQueryClient();
  const listKey = keys.chairStats.byShop(shopId);

  return useMutation({
    mutationFn: ({
      chairId,
      serviceId,
      canPerform,
    }: {
      chairId: string;
      serviceId: string;
      canPerform: boolean;
    }) => setCanPerform(chairId, serviceId, canPerform),
    onMutate: async ({ chairId, serviceId, canPerform }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous =
        queryClient.getQueryData<ChairServiceStat[]>(listKey);
      queryClient.setQueryData<ChairServiceStat[]>(listKey, (rows) =>
        rows?.map((r) =>
          r.chair_id === chairId && r.service_id === serviceId
            ? { ...r, can_perform: canPerform }
            : r,
        ) ?? [],
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
}