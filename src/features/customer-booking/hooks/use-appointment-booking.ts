"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { ymd } from "@/lib/day-key";
import {
  bookAppointment,
  getAvailableSlots,
  getMyAppointments,
} from "../api/appointments.api";

/**
 * Free slots for a day.
 *
 * Short `staleTime`: someone else's booking makes this list wrong, and the
 * grid is the one screen where a stale answer wastes a customer's tap.
 */
export function useAvailableSlots(
  shopId: string,
  day: Date,
  serviceIds: string[],
  staffId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: keys.appointments.slots(shopId, ymd(day), serviceIds, staffId),
    queryFn: () => getAvailableSlots(shopId, day, serviceIds, staffId),
    enabled: enabled && serviceIds.length > 0,
    staleTime: 15_000,
  });
}

export function useBookAppointment(shopId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bookAppointment,
    onSuccess: () => {
      // Both the customer's own list and every cached slot grid for this shop:
      // the slot just taken has to disappear for this browser too.
      void queryClient.invalidateQueries({ queryKey: keys.appointments.mine() });
      void queryClient.invalidateQueries({ queryKey: ["appointments", "slots", shopId] });
    },
  });
}

export function useMyAppointments() {
  return useQuery({
    queryKey: keys.appointments.mine(),
    queryFn: getMyAppointments,
  });
}
