"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  createManualEntry,
  deleteManualEntry,
  getManualEntries,
  getShopChairsForEntries,
  getShopServicesForEntries,
  updateManualEntry,
} from "../api/income.api";
import type { ManualEntryFormOutput } from "../schemas/manual-entry.schema";

/** Shop's own services + chairs, for the manual-entry form's dropdowns. */
export function useManualEntryPickers(shopId: string | undefined) {
  const servicesQuery = useQuery({
    queryKey: keys.services.byShop(shopId ?? ""),
    queryFn: () => getShopServicesForEntries(shopId!),
    enabled: !!shopId,
  });
  const chairsQuery = useQuery({
    queryKey: keys.chairs.byShop(shopId ?? ""),
    queryFn: () => getShopChairsForEntries(shopId!),
    enabled: !!shopId,
  });
  return {
    services: servicesQuery.data ?? [],
    chairs: chairsQuery.data ?? [],
  };
}

/** The editable list of past manual entries — same rows the income summary aggregates. */
export function useManualEntryList(shopId: string | undefined) {
  const query = useQuery({
    queryKey: keys.manualEntries.byShop(shopId ?? ""),
    queryFn: () => getManualEntries(shopId!),
    enabled: !!shopId,
  });
  return { entries: query.data ?? [], isPending: query.isPending };
}

export function useManualEntryMutations(shopId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: keys.manualEntries.byShop(shopId) });
  };

  const create = useMutation({
    mutationFn: (values: ManualEntryFormOutput) => createManualEntry(shopId, values),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ entryId, values }: { entryId: string; values: ManualEntryFormOutput }) =>
      updateManualEntry(entryId, values),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (entryId: string) => deleteManualEntry(entryId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
