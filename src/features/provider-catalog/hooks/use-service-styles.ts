"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  listServiceStyles,
  listStyleCatalogue,
  setServiceStyles,
  type ServiceStyleRow,
} from "../api/service-styles.api";

export type { ServiceStyleRow };

export function useServiceStyles(shopId: string) {
  return useQuery({
    queryKey: keys.serviceStyles.byShop(shopId),
    queryFn: () => listServiceStyles(shopId),
    enabled: !!shopId,
  });
}

export function useStyleCatalogue() {
  return useQuery({
    queryKey: keys.serviceStyles.catalogue(),
    queryFn: listStyleCatalogue,
    // Admin-managed and changes a handful of times a year.
    staleTime: 10 * 60 * 1000,
  });
}

export function useSetServiceStyles(shopId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, hairstyleIds }: { serviceId: string; hairstyleIds: string[] }) =>
      setServiceStyles(serviceId, hairstyleIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.serviceStyles.byShop(shopId) });
      // Also the customer-facing read: a shop that just switched a style off
      // should stop offering it on the booking screen without a reload. The
      // key is a branch prefix because the customer's key carries a service-id
      // list this hook has no way to enumerate.
      void queryClient.invalidateQueries({ queryKey: ["service-styles", "services"] });
    },
  });
}
