"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { upsertById } from "@/lib/query/realtime-cache";
import type { Service } from "@/types";
import {
  createService,
  getServices,
  setServiceActive,
  updateService,
} from "../api/services.api";
import type { ServiceFormOutput } from "../schemas/service.schema";

export function useServices(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.services.byShop(shopId ?? ""),
    queryFn: () => getServices(shopId!),
    enabled: !!shopId,
  });
}

export function useServiceMutations(shopId: string) {
  const queryClient = useQueryClient();
  const listKey = keys.services.byShop(shopId);

  const patchList = (service: Service) =>
    queryClient.setQueryData<Service[]>(listKey, (rows) =>
      upsertById(rows, service, (a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    );

  const create = useMutation({
    mutationFn: (values: ServiceFormOutput) => createService(shopId, values),
    onSuccess: (service) => {
      patchList(service);
      // new stats rows were auto-provisioned by the DB — refresh the matrix
      void queryClient.invalidateQueries({
        queryKey: keys.chairStats.byShop(shopId),
      });
    },
  });

  const update = useMutation({
    mutationFn: ({
      serviceId,
      values,
    }: {
      serviceId: string;
      values: ServiceFormOutput;
    }) => updateService(serviceId, values),
    onSuccess: patchList,
  });

  // optimistic toggle with rollback
  const toggleActive = useMutation({
    mutationFn: ({
      serviceId,
      isActive,
    }: {
      serviceId: string;
      isActive: boolean;
    }) => setServiceActive(serviceId, isActive),
    onMutate: async ({ serviceId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Service[]>(listKey);
      queryClient.setQueryData<Service[]>(listKey, (rows) =>
        rows?.map((s) =>
          s.id === serviceId ? { ...s, is_active: isActive } : s,
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

  return { create, update, toggleActive };
}