"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import type { ServiceCategory } from "@/config/constants";
import { getAllActiveServices } from "../api/services.api";

export function useServiceCategories() {
  const query = useQuery({ queryKey: keys.services.allActive(), queryFn: getAllActiveServices });

  const derived = useMemo(() => {
    const categoriesByShopId = new Map<string, Set<ServiceCategory>>();
    const serviceNamesByShopId = new Map<string, string[]>();
    const presentCategories = new Set<ServiceCategory>();

    for (const row of query.data ?? []) {
      const names = serviceNamesByShopId.get(row.shop_id) ?? [];
      names.push(row.name);
      serviceNamesByShopId.set(row.shop_id, names);

      if (row.category) {
        const category = row.category as ServiceCategory;
        presentCategories.add(category);
        const set = categoriesByShopId.get(row.shop_id) ?? new Set<ServiceCategory>();
        set.add(category);
        categoriesByShopId.set(row.shop_id, set);
      }
    }

    return { categoriesByShopId, serviceNamesByShopId, presentCategories };
  }, [query.data]);

  return { ...query, ...derived };
}
