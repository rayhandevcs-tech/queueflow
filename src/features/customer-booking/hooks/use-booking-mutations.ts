"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { cancelMySerial, createBooking } from "../api/booking.api";

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      shopId,
      serviceIds,
    }: {
      shopId: string;
      serviceIds: string[];
    }) => createBooking(shopId, serviceIds),
    onSuccess: (serial) => {
      queryClient.setQueryData(keys.serials.mine(), serial);
    },
  });
}

export function useCancelMySerial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serialId: string) => cancelMySerial(serialId),
    onSuccess: () => {
      queryClient.setQueryData(keys.serials.mine(), null);
    },
  });
}
