"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import type { VoiceIntent } from "../lib/intent-schema";

export type VoiceErrorCode =
  | "NO_SERVICES"
  | "ANTHROPIC_KEY_MISSING"
  | "GENERIC";

/** Ask the model what a spoken sentence meant. Nothing is executed here. */
export function useVoiceIntent() {
  const [error, setError] = useState<VoiceErrorCode | null>(null);

  const mutation = useMutation<VoiceIntent, Error, string>({
    mutationFn: async (transcript: string) => {
      const res = await fetch("/api/ai/voice-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          body?.error === "NO_SERVICES"
            ? "NO_SERVICES"
            : body?.error === "ANTHROPIC_KEY_MISSING"
              ? "ANTHROPIC_KEY_MISSING"
              : "GENERIC",
        );
        throw new Error(body?.error ?? "GENERIC");
      }

      setError(null);
      const body = (await res.json()) as { intent: VoiceIntent };
      return body.intent;
    },
  });

  return { ...mutation, errorCode: error, clearError: () => setError(null) };
}

/**
 * Runs a confirmed intent through the ordinary write paths.
 *
 * Every branch here inserts exactly what the equivalent screen would insert —
 * the DB triggers still assign the chair, price the services and compute the
 * position. Voice is a faster way to reach the same buttons, so it must not be
 * a second, subtly different way of writing the same rows.
 */
export function useRunVoiceIntent(shopId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (intent: VoiceIntent) => {
      const supabase = getBrowserClient();
      if (!shopId) throw new Error("NO_SHOP");

      if (intent.intent === "add_walk_in" && intent.walkIn) {
        const { error } = await supabase.from("serials").insert({
          shop_id: shopId,
          is_walk_in: true,
          customer_name: intent.walkIn.customerName.trim(),
          customer_phone: null,
          service_ids: intent.walkIn.serviceIds,
          chair_id: intent.walkIn.chairId,
        });
        if (error) throw error;
        return;
      }

      if (intent.intent === "add_expense" && intent.expense) {
        const { error } = await supabase.from("shop_expenses").insert({
          shop_id: shopId,
          category: intent.expense.category,
          amount: intent.expense.amount,
          note: intent.expense.note,
          // Spoken expenses are about today. Anything else is a correction the
          // owner should make on the expenses screen, where they can see dates.
          spent_on: new Date().toISOString().slice(0, 10),
        });
        if (error) throw error;
        return;
      }

      if (intent.intent === "add_manual_income" && intent.manualIncome) {
        const { error } = await supabase.from("manual_entries").insert({
          shop_id: shopId,
          service_id: intent.manualIncome.serviceId,
          amount: intent.manualIncome.amount,
          customer_name: intent.manualIncome.customerName,
          payment_status: "PAID",
          payment_method: "cash",
        });
        if (error) throw error;
        return;
      }

      if (intent.intent === "set_shop_open" && intent.shopOpen) {
        const { error } = await supabase
          .from("shops")
          .update({ is_open: intent.shopOpen.open })
          .eq("id", shopId);
        if (error) throw error;
        return;
      }

      throw new Error("UNSUPPORTED_INTENT");
    },
    onSuccess: () => {
      // Broad rather than surgical: one voice command can touch the board, the
      // ledger and the shop row, and this runs once per command — not on a hot
      // path where over-invalidating would cost anything.
      void queryClient.invalidateQueries({ queryKey: keys.serials.byShop(shopId ?? "") });
      void queryClient.invalidateQueries({ queryKey: keys.expenses.byShop(shopId ?? "") });
      void queryClient.invalidateQueries({ queryKey: keys.manualEntries.byShop(shopId ?? "") });
      void queryClient.invalidateQueries({ queryKey: keys.shops.mine() });
    },
  });
}

/** Ties dictation, understanding and running into the flow the sheet renders. */
export type VoiceStage = "idle" | "listening" | "thinking" | "confirm" | "running";

export function useVoiceStage() {
  const [stage, setStage] = useState<VoiceStage>("idle");
  const [intent, setIntent] = useState<VoiceIntent | null>(null);

  const reset = useCallback(() => {
    setStage("idle");
    setIntent(null);
  }, []);

  return { stage, setStage, intent, setIntent, reset };
}
