"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getAppointmentList } from "../api/appointments.api";
import { buildListQuery, type ListFilters } from "../lib/list-query";
import type { AppointmentListRow } from "../lib/types";

/**
 * The filtered appointment list.
 *
 * The filters are part of the query key, so switching tabs shows a cached
 * answer instantly and re-fetches behind it rather than blanking the table.
 *
 * `now` is captured once per filter change instead of on every render: the
 * "upcoming" bound is a timestamp, and re-reading the clock each render would
 * change the query's arguments continuously and re-fetch forever.
 */
export function useAppointmentList(shopId: string, filters: ListFilters) {
  const query = useMemo(
    () => buildListQuery(filters, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the clock is read once per filter change, on purpose
    [filters.scope, filters.staffId, filters.from, filters.to],
  );

  return useQuery({
    queryKey: keys.appointments.list(shopId, filters),
    queryFn: (): Promise<AppointmentListRow[]> => getAppointmentList(shopId, query),
    staleTime: 30_000,
  });
}
