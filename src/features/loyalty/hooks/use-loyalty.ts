"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  adjustLoyaltyPoints,
  getLoyaltyCustomerNames,
  getLoyaltyLedger,
  getLoyaltySettings,
  getMyLoyaltyCards,
  getShopLoyaltyAccounts,
  saveLoyaltySettings,
} from "../api/loyalty.api";
import type { LoyaltySettingsFormOutput } from "../schemas/settings.schema";

/**
 * Loyalty queries and mutations.
 *
 * No realtime channel, for the third time in a row and the same reason:
 * neither loyalty table is in the realtime publication, so a subscription
 * would be a silent no-op that also demanded a Supabase dashboard step. Points
 * move when a job is finished — an event the owner is already looking at — so
 * invalidation after each mutation is the whole requirement.
 */

export function useLoyaltySettings(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.loyalty.settings(shopId ?? ""),
    queryFn: () => getLoyaltySettings(shopId!),
    enabled: !!shopId,
  });
}

export function useShopLoyaltyAccounts(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.loyalty.accounts(shopId ?? ""),
    queryFn: () => getShopLoyaltyAccounts(shopId!),
    enabled: !!shopId,
  });
}

/**
 * The names behind the account rows.
 *
 * A separate query from the accounts themselves so the table paints as soon
 * as the balances arrive: a row that briefly shows a balance without a name
 * is far better than a table that waits for the shop's whole work history.
 */
export function useLoyaltyCustomerNames(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.loyalty.customerNames(shopId ?? ""),
    queryFn: () => getLoyaltyCustomerNames(shopId!),
    enabled: !!shopId,
    staleTime: 5 * 60_000,
  });
}

/** One customer's ledger — only fetched while their drawer is open. */
export function useLoyaltyLedger(
  shopId: string | undefined,
  customerId: string | undefined,
) {
  return useQuery({
    queryKey: keys.loyalty.ledger(shopId ?? "", customerId ?? ""),
    queryFn: () => getLoyaltyLedger(shopId!, customerId!),
    enabled: !!shopId && !!customerId,
  });
}

export function useMyLoyaltyCards() {
  return useQuery({
    queryKey: keys.loyalty.myCards(),
    queryFn: getMyLoyaltyCards,
    staleTime: 60_000,
  });
}

/**
 * The owner's two writes: the rules, and a correction.
 *
 * A correction invalidates the accounts list, that customer's ledger and the
 * customer's own card list — the balance the owner just changed is a number
 * the customer is looking at too, and leaving their card stale would make the
 * app disagree with itself.
 */
export function useLoyaltyActions(shopId: string) {
  const queryClient = useQueryClient();

  const saveSettings = useMutation({
    mutationFn: (values: LoyaltySettingsFormOutput) => saveLoyaltySettings(shopId, values),
    onSuccess: (settings) => {
      queryClient.setQueryData(keys.loyalty.settings(shopId), settings);
    },
  });

  const adjust = useMutation({
    mutationFn: (input: { customerId: string; points: number; note?: string | null }) =>
      adjustLoyaltyPoints({ shopId, ...input }),
    onSettled: (_data, _err, vars) => {
      for (const queryKey of [
        keys.loyalty.accounts(shopId),
        keys.loyalty.ledger(shopId, vars.customerId),
        keys.loyalty.myCards(),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  return { saveSettings, adjust };
}
