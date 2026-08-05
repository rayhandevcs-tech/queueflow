"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  cancelMyGroup,
  cancelMySerial,
  createBooking,
  createGroupBooking,
  markArrived,
  type AdvancePaymentInfo,
  type PartyMember,
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
      queryClient.setQueryData(keys.serials.mine(), [serial]);
    },
  });
}

export function useCreateGroupBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      shopId,
      members,
      chairId,
      travelMin,
    }: {
      shopId: string;
      members: PartyMember[];
      chairId?: string | null;
      travelMin?: number | null;
    }) => createGroupBooking(shopId, members, { chairId, travelMin }),
    // The RPC returns only the group id; the rows themselves (positions,
    // chairs, ETAs) were all decided server-side.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.serials.mine() });
    },
  });
}

export function useCancelMyGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => cancelMyGroup(groupId),
    onSuccess: () => {
      queryClient.setQueryData(keys.serials.mine(), []);
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
    // Not `[]` — cancelling one member of a party leaves the others booked.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.serials.mine() });
    },
  });
}
