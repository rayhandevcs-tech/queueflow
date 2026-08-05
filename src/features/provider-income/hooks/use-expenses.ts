"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { useRealtimeChannel } from "@/lib/supabase/realtime";
import { useNowMs } from "@/hooks/use-now";
import type { ShopExpense } from "@/types";
import {
  createExpense,
  deleteExpense,
  getShopExpenses,
  type ExpenseInput,
} from "../api/income.api";
import { computeExpenseSummary, type ExpenseSummary } from "../lib/compute-profit";

const EMPTY: ExpenseSummary = {
  today: 0,
  month: 0,
  year: 0,
  byCategory: [],
  monthlyTrend: Array(12).fill(0),
};

export function useExpenses(shopId: string | undefined) {
  const queryClient = useQueryClient();
  const expensesKey = keys.expenses.byShop(shopId ?? "");
  // Same one-minute tick the income summary uses, so "today" and "this month"
  // roll over on both halves of the page at the same moment.
  const nowMs = useNowMs(60_000);

  const query = useQuery({
    queryKey: expensesKey,
    queryFn: () => getShopExpenses(shopId!),
    enabled: !!shopId,
  });

  useRealtimeChannel<ShopExpense>({
    channelKey: `provider:${shopId ?? "none"}:expenses`,
    table: "shop_expenses",
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    enabled: !!shopId,
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: expensesKey });
    },
  });

  const summary = useMemo(
    () => (query.data ? computeExpenseSummary(query.data, new Date(nowMs)) : EMPTY),
    [query.data, nowMs],
  );

  const add = useMutation({
    mutationFn: (values: ExpenseInput) => createExpense(shopId!, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expensesKey });
    },
  });

  const remove = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(expenseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expensesKey });
    },
  });

  return {
    expenses: query.data ?? [],
    summary,
    isPending: query.isPending,
    add,
    remove,
  };
}
