"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  addTimeOff,
  getStaffHours,
  getTimeOff,
  removeTimeOff,
  rescheduleAppointment,
  setStaffDay,
} from "../api/availability.api";

/**
 * Changing anyone's hours or leave changes what is bookable, so every
 * mutation here clears the slot caches as well as its own list. Leaving a
 * stale slot grid up after marking someone on leave would offer a time the
 * database has just started refusing.
 */
function invalidateAvailability(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["staff-availability"] });
  void queryClient.invalidateQueries({ queryKey: ["appointments", "slots"] });
}

export function useStaffHours(chairIds: string[]) {
  return useQuery({
    queryKey: keys.staffAvailability.hours(chairIds),
    queryFn: () => getStaffHours(chairIds),
    enabled: chairIds.length > 0,
  });
}

export function useTimeOff(chairIds: string[]) {
  return useQuery({
    queryKey: keys.staffAvailability.timeOff(chairIds),
    queryFn: () => getTimeOff(chairIds),
    enabled: chairIds.length > 0,
  });
}

export function useStaffDayMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      chairId,
      weekday,
      hours,
    }: {
      chairId: string;
      weekday: number;
      hours: { start: string; end: string } | null;
    }) => setStaffDay(chairId, weekday, hours),
    onSuccess: () => invalidateAvailability(queryClient),
  });
}

export function useTimeOffMutations() {
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: addTimeOff,
    onSuccess: () => invalidateAvailability(queryClient),
  });
  const remove = useMutation({
    mutationFn: removeTimeOff,
    onSuccess: () => invalidateAvailability(queryClient),
  });
  return { add, remove };
}

export function useRescheduleAppointment(shopId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rescheduleAppointment,
    onSuccess: () => {
      // The appointment moved days, so no single day key is enough.
      void queryClient.invalidateQueries({ queryKey: ["appointments", shopId] });
      void queryClient.invalidateQueries({ queryKey: ["appointments", "slots", shopId] });
      void queryClient.invalidateQueries({ queryKey: keys.appointments.mine() });
    },
  });
}
