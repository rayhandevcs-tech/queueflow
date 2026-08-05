"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  cancelMySerial,
  createBooking,
  markArrived,
  type AdvancePaymentInfo,
} from "../api/booking.api";

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      shopId,
      serviceIds,
      advance,
      chairId,
      travelMin,
    }: {
      shopId: string;
      serviceIds: string[];
      advance?: AdvancePaymentInfo;
      chairId?: string | null;
      travelMin?: number | null;
    }) => createBooking(shopId, serviceIds, { advance, chairId, travelMin }),
    onSuccess: (serial) => {
      queryClient.setQueryData(keys.serials.mine(), serial);
    },
  });
}

export function useMarkArrived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serialId: string) => markArrived(serialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.serials.mine() });
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
