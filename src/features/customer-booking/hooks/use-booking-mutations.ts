"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  cancelMySerial,
  createBooking,
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
    }: {
      shopId: string;
      serviceIds: string[];
      advance?: AdvancePaymentInfo;
      chairId?: string | null;
    }) => createBooking(shopId, serviceIds, { advance, chairId }),
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
