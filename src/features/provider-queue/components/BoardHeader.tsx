"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCheck, Users } from "lucide-react";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Shop } from "@/types";
import { Button } from "@/components/ui/Button";

async function getMyShopRow(shopId: string): Promise<Shop> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .single();
  if (error) throw error;
  return data;
}

interface Props {
  shopId: string;
  totals: { waiting: number; inProgress: number };
  onWalkIn: () => void;
}

export function BoardHeader({ shopId, totals, onWalkIn }: Props) {
  const queryClient = useQueryClient();

  const { data: shop } = useQuery({
    queryKey: keys.shops.detail(shopId),
    queryFn: () => getMyShopRow(shopId),
  });

  const toggleOpen = useMutation({
    mutationFn: async (isOpen: boolean) => {
      const supabase = getBrowserClient();
      const { data, error } = await supabase
        .from("shops")
        .update({ is_open: isOpen })
        .eq("id", shopId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.shops.detail(shopId), updated);
      queryClient.setQueryData(keys.shops.mine(), updated);
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-xl font-bold">Live Queue</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            Waiting {totals.waiting}
          </span>
          <span className="flex items-center gap-1">
            <UserCheck className="h-3.5 w-3.5" />
            In progress {totals.inProgress}
          </span>
        </div>
      </div>

      {shop && (
        <button
          onClick={() => toggleOpen.mutate(!shop.is_open)}
          disabled={toggleOpen.isPending}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50",
            shop.is_open ? "bg-good-soft text-good" : "bg-soft text-muted",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              shop.is_open ? "bg-good animate-pulse" : "bg-muted",
            )}
          />
          {shop.is_open ? "Shop open" : "Shop closed"}
        </button>
      )}

      <Button onClick={onWalkIn}>
        <Plus className="h-4 w-4" />
        Walk-in
      </Button>
    </div>
  );
}
