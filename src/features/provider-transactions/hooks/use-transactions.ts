"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  getAppointmentTransactions,
  getExpenseTransactions,
  getManualTransactions,
  getSerialTransactions,
} from "../api/transactions.api";

export function useSerialTransactions(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.transactions.serials(shopId ?? ""),
    queryFn: () => getSerialTransactions(shopId!),
    enabled: !!shopId,
  });
}

export function useManualTransactions(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.transactions.manual(shopId ?? ""),
    queryFn: () => getManualTransactions(shopId!),
    enabled: !!shopId,
  });
}

export function useExpenseTransactions(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.transactions.expenses(shopId ?? ""),
    queryFn: () => getExpenseTransactions(shopId!),
    enabled: !!shopId,
  });
}

export function useAppointmentTransactions(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.transactions.appointments(shopId ?? ""),
    queryFn: () => getAppointmentTransactions(shopId!),
    enabled: !!shopId,
  });
}
