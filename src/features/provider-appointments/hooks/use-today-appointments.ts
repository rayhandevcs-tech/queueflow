"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  completeAppointment,
  getAppointmentsForDay,
  setAppointmentStatus,
} from "../api/appointments.api";
import { ymd } from "../lib/schedule";
import type { AppointmentCard, AppointmentStatus } from "../lib/types";

/**
 * One day's bookings for a shop.
 *
 * Sprint 2 built this as a real `useQuery` returning an empty array, so the
 * board's loading and error states existed before there was anything to load.
 * Sprint 4 replaced only the `queryFn` body — every component reading it is
 * unchanged, which is what that seam was for (decision 39).
 */
export function useTodayAppointments(shopId: string, day: Date) {
  return useQuery({
    queryKey: keys.appointments.byShopDay(shopId, ymd(day)),
    queryFn: (): Promise<AppointmentCard[]> => getAppointmentsForDay(shopId, day),
    staleTime: 30_000,
  });
}

/**
 * Move one appointment along its lifecycle.
 *
 * No optimistic update: the database owns the state machine, and a refused
 * move (a racing tap, a status that has already advanced) should leave the
 * board showing what is actually true rather than a guess it then has to take
 * back.
 */
export function useAppointmentStatus(shopId: string, day: Date) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: AppointmentStatus;
      reason?: string;
    }) => setAppointmentStatus(id, status, reason),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: keys.appointments.byShopDay(shopId, ymd(day)),
      }),
  });
}

/**
 * Finish an appointment and record the payment in the same write.
 *
 * Separate from `useAppointmentStatus` because it invalidates more: the money
 * screens read `appointments` directly now, and `appointments` is not in the
 * realtime publication, so nothing else would tell income, the transaction
 * list or the due ledger that a job just closed. Invalidating here is what
 * keeps them honest — see the note in `use-income-summary.ts` for why a
 * realtime channel was not the answer.
 */
export function useCompleteAppointment(shopId: string, day: Date) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payment,
    }: {
      id: string;
      payment: { method: string } | { due: number };
    }) => completeAppointment(id, payment),
    onSettled: () => {
      for (const queryKey of [
        keys.appointments.byShopDay(shopId, ymd(day)),
        keys.appointments.incomeHistory(shopId),
        keys.transactions.appointments(shopId),
        keys.dueLedger.appointmentsByShop(shopId),
      ]) {
        queryClient.invalidateQueries({ queryKey });
      }
      // The list page's own key carries its filters, so invalidate the whole
      // branch rather than guessing which filter combination is mounted.
      queryClient.invalidateQueries({ queryKey: ["appointments", "list", shopId] });
    },
  });
}
