"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getServiceStyleOptions, type ServiceStyleOption } from "../api/booking.api";

export type { ServiceStyleOption };

/**
 * The styles offered for the services the customer has selected.
 *
 * Disabled until something is selected, so opening a shop page costs no query
 * — and an empty result is a perfectly good answer meaning "this shop has not
 * set any up", which the picker renders as nothing at all.
 */
export function useServiceStyleOptions(serviceIds: string[]) {
  return useQuery({
    queryKey: keys.serviceStyles.forServices(serviceIds),
    queryFn: () => getServiceStyleOptions(serviceIds),
    enabled: serviceIds.length > 0,
  });
}
