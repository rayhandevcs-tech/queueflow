"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import {
  cancelProposal,
  confirmProposal,
  getProposal,
  type ConfirmFailure,
  type ConfirmSuccess,
} from "../api/proposals.api";

/**
 * The confirmation card's state machine.
 *
 * The brief asked for eight named UI states, and they are worth having as one
 * explicit union rather than as a handful of booleans: `loading && !error &&
 * !done && !cancelled` is how a card ends up showing a spinner and a success
 * message at the same time.
 *
 *   LOADING    fetching the stored proposal
 *   PROPOSED   waiting for the customer
 *   EXECUTING  confirm is in flight — the button is disabled
 *   SUCCESS    the serial exists
 *   FAILED     confirmed, then refused; retryable
 *   CANCELLED  the customer declined
 *   EXPIRED    the proposal lapsed
 *   GONE       no such proposal for this customer
 *
 * `DISCOVERING` from the brief is the chat's own streaming state, which
 * `useStreamingChat` already owns — there is no proposal to be in a state about
 * until the turn produces one, so adding it here would have been a second
 * source of truth for "the assistant is thinking".
 */
export type ProposalStage =
  | "LOADING"
  | "PROPOSED"
  | "EXECUTING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "GONE";

/**
 * @param nowMs Wall clock, passed in rather than read here.
 *
 * `Date.now()` during render is an impure call and the React Compiler lint
 * refuses it — correctly, because a value that changes on every re-render makes
 * the derived stage unstable. The card supplies a ticking clock from `useNowMs`,
 * which is the app's existing helper for exactly this.
 */
export function useProposal(actionId: string | null, nowMs: number) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ConfirmSuccess | null>(null);
  const [failure, setFailure] = useState<ConfirmFailure | null>(null);
  const [declined, setDeclined] = useState(false);

  const query = useQuery({
    queryKey: keys.aiActions.proposal(actionId ?? ""),
    queryFn: () => getProposal(actionId!),
    enabled: !!actionId,
    // The row does not change on its own while the card is open — the only
    // things that move it are this card's own two buttons — so polling it would
    // be requests for nothing. Expiry is handled by the countdown below and,
    // authoritatively, by the server at confirm time.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const proposal = query.data;
      if (!proposal) throw new Error("NO_PROPOSAL");
      return confirmProposal(proposal.id, proposal.nonce);
    },
    onSuccess: (answer) => {
      if (answer.ok) {
        setResult(answer);
        setFailure(null);
        // A serial now exists, so every screen that counts them is stale: the
        // customer's own queue view, their serial list, and the shop's live
        // queue. Broad rather than surgical — this runs once per confirmation,
        // not on a hot path.
        void queryClient.invalidateQueries({ queryKey: keys.serials.mine() });
        // The shop's live queue got a row. `["queue-public"]` as a prefix
        // rather than a specific shop: the customer's explore list keys by
        // shop and the counts key is separate, and both are now one behind.
        void queryClient.invalidateQueries({ queryKey: ["queue-public"] });
      } else {
        setFailure(answer);
      }
      // The proposal row itself moved — to EXECUTED or FAILED — so the card's
      // own query is stale either way.
      if (query.data) {
        void queryClient.invalidateQueries({
          queryKey: keys.aiActions.proposal(query.data.id),
        });
      }
    },
    onError: () => setFailure({ ok: false, code: "UNAVAILABLE" }),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const proposal = query.data;
      if (!proposal) return false;
      return cancelProposal(proposal.id);
    },
    // Declined either way. If the server refused the cancel, the proposal was
    // already past PROPOSED and will expire on its own; what must not happen is
    // the card staying on a live confirm button after the customer said no.
    onSettled: () => setDeclined(true),
  });

  const stage = ((): ProposalStage => {
    if (!actionId || query.isPending) return "LOADING";
    if (!query.data) return "GONE";
    if (result) return "SUCCESS";
    if (failure) return failure.code === "EXPIRED" ? "EXPIRED" : "FAILED";
    if (declined) return "CANCELLED";
    if (confirm.isPending) return "EXECUTING";

    // The stored status wins over local state — it is what the server thinks,
    // and a row that was cancelled or executed in another tab should show that.
    switch (query.data.status) {
      case "EXECUTED":
        return "SUCCESS";
      case "CANCELLED":
        return "CANCELLED";
      case "EXPIRED":
        return "EXPIRED";
      case "FAILED":
        return "FAILED";
      default:
        break;
    }

    // Client-side expiry is a courtesy, not the gate. The server re-checks
    // `expires_at` inside `ai_action_claim()` with its own clock, so a customer
    // whose device clock is wrong cannot confirm a lapsed proposal.
    if (new Date(query.data.expiresAt).getTime() <= nowMs) return "EXPIRED";
    return "PROPOSED";
  })();

  const reset = useCallback(() => {
    setResult(null);
    setFailure(null);
    setDeclined(false);
  }, []);

  return {
    stage,
    proposal: query.data ?? null,
    result,
    failure,
    confirm: confirm.mutate,
    cancel: cancel.mutate,
    /** True while a confirmation is in flight — the button's disabled state. */
    busy: confirm.isPending || cancel.isPending,
    reset,
  };
}
