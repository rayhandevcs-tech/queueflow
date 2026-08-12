"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { upsertById } from "@/lib/query/realtime-cache";
import type { Chair } from "@/types";
import {
  createChair,
  deleteChair,
  getChairs,
  setChairActive,
  updateChair,
} from "../api/chairs.api";
import type { ChairFormOutput } from "../schemas/chair.schema";

const bySortOrder = (a: Chair, b: Chair) => a.sort_order - b.sort_order;

export function useChairs(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.chairs.byShop(shopId ?? ""),
    queryFn: () => getChairs(shopId!),
    enabled: !!shopId,
  });
}

export function useChairMutations(shopId: string) {
  const queryClient = useQueryClient();
  const listKey = keys.chairs.byShop(shopId);

  const patchList = (chair: Chair) =>
    queryClient.setQueryData<Chair[]>(listKey, (rows) =>
      upsertById(rows, chair, bySortOrder),
    );

  const create = useMutation({
    mutationFn: (values: ChairFormOutput) => {
      const current =
        queryClient.getQueryData<Chair[]>(listKey)?.length ?? 0;
      return createChair(shopId, values, current + 1);
    },
    onSuccess: (chair) => {
      patchList(chair);
      void queryClient.invalidateQueries({
        queryKey: keys.chairStats.byShop(shopId),
      });
    },
  });

  const update = useMutation({
    mutationFn: ({
      chairId,
      patch,
    }: {
      chairId: string;
      patch: Parameters<typeof updateChair>[1];
    }) => updateChair(chairId, patch),
    onSuccess: patchList,
  });

  const toggleActive = useMutation({
    mutationFn: ({
      chairId,
      isActive,
    }: {
      chairId: string;
      isActive: boolean;
    }) => setChairActive(chairId, isActive),
    onMutate: async ({ chairId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Chair[]>(listKey);
      queryClient.setQueryData<Chair[]>(listKey, (rows) =>
        rows?.map((c) =>
          c.id === chairId ? { ...c, is_active: isActive } : c,
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

  // hard delete when safe, pause fallback when the DB rejects it — see deleteChair
  const remove = useMutation({
    mutationFn: (chairId: string) => deleteChair(chairId),
    onSuccess: ({ deleted }, chairId) => {
      queryClient.setQueryData<Chair[]>(listKey, (rows) =>
        deleted
          ? rows?.filter((c) => c.id !== chairId)
          : rows?.map((c) => (c.id === chairId ? { ...c, is_active: false } : c)),
      );
    },
  });

  return { create, update, toggleActive, remove };
}