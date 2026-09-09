"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { ymd } from "../lib/schedule";
import type { AppointmentCard } from "../lib/types";

/**
 * One day's bookings for a shop.
 *
 * **This is the Sprint 4 seam.** The `appointments` table does not exist yet
 * (§৩ Sprint 4 of the plan), so this resolves to an empty day and the board
 * draws its empty state. When the table lands, only the `queryFn` body
 * changes — the query key, the return shape and every component reading it
 * are already what they will be.
 *
 * It is a real `useQuery` rather than a bare `return []` on purpose: the
 * board must already handle `isPending` and `isError`, or Sprint 4 would be
 * the sprint that discovers the screen has no loading or failure states.
 */
export function useTodayAppointments(shopId: string, day: Date) {
  return useQuery({
    queryKey: keys.appointments.byShopDay(shopId, ymd(day)),
    queryFn: async (): Promise<AppointmentCard[]> => {
      // Sprint 4 replaces this with a select on `appointments` filtered by
      // shop and by the day's local window. Querying the table now would
      // fail on every parlour dashboard, which is worse than an honest
      // empty day.
      return [];
    },
    staleTime: 30_000,
  });
}
