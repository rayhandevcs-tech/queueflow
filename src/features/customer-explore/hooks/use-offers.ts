"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getActiveOffers } from "../api/offers.api";

export function useActiveOffers() {
  return useQuery({ queryKey: keys.offers.activeCarousel(), queryFn: getActiveOffers });
}
