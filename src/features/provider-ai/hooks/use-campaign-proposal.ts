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
} from "@/lib/ai/proposal-client";
import {
  AI_ACTION_SEND_CAMPAIGN,
  type CampaignDraft,
} from "@/lib/ai/proposals";
import { campaignShapeProblem } from "@/lib/campaign-content";

/**
 * The campaign approval card's state machine.
 *
 * Built alongside the customer card's `useProposal` rather than shared with it,
 * and the reason is the edit. A campaign has a state the other three actions do
 * not have — the owner is rewriting the message — and it has a THIRD button
 * because of it. Folding that into the customer hook would have meant an
 * editing mode that three of four callers ignore, plus a `campaign` argument on
 * a confirm path that mostly has nothing to send.
 *
 * The lifecycle itself is identical and deliberately so: the same
 * `getProposal`, the same `confirmProposal`, the same `cancelProposal`, the
 * same eight stages, the same "the stored status wins over local state" rule.
 * What is shared is the part that must not drift (the endpoint contract); what
 * is separate is the part that genuinely differs (what the card does).
 *
 *   LOADING    fetching the stored proposal
 *   PROPOSED   waiting for the owner — they may be editing
 *   EXECUTING  the send is in flight; every button is disabled
 *   SENT       the broadcast succeeded, and the count came from the server
 *   FAILED     approved, then refused; the reason is shown
 *   CANCELLED  the owner said no
 *   EXPIRED    the proposal lapsed, so the audience list had gone stale
 *   GONE       no such proposal for this owner
 */
export type CampaignStage =
  | "LOADING"
  | "PROPOSED"
  | "EXECUTING"
  | "SENT"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "GONE";

/** Why an edit was refused, before it is ever posted. */
export type EditProblem = "EMPTY" | "TITLE_TOO_LONG" | "BODY_TOO_LONG";

/**
 * @param nowMs Wall clock, passed in rather than read here.
 *
 * `Date.now()` during render is an impure call and the React Compiler lint
 * refuses it — correctly, because a value that changes on every re-render makes
 * the derived stage unstable. The card supplies a ticking clock from `useNowMs`.
 */
export function useCampaignProposal(actionId: string | null, nowMs: number) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ConfirmSuccess | null>(null);
  const [failure, setFailure] = useState<ConfirmFailure | null>(null);
  const [declined, setDeclined] = useState(false);

  /**
   * The owner's edit, while they are typing.
   *
   * `null` means "they have not changed anything", which is different from
   * "they typed the same words back" — the first sends no `campaign` field at
   * all, so the endpoint does not touch the row. Keeping that distinction means
   * an owner who opened the editor and closed it again leaves no trace in the
   * audit trail, which is accurate: they did not edit it.
   */
  const [edit, setEdit] = useState<{ title: string; body: string } | null>(null);
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: keys.aiActions.proposal(actionId ?? ""),
    queryFn: () => getProposal(actionId!),
    enabled: !!actionId,
    // The row does not change on its own while the card is open — the only
    // things that move it are this card's own buttons — so polling would be
    // requests for nothing. Expiry is handled by the countdown below and,
    // authoritatively, by the server at confirm time.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const stored = query.data?.display ?? null;
  const draft: CampaignDraft | null =
    stored && stored.action === AI_ACTION_SEND_CAMPAIGN ? stored : null;

  /** What will actually be sent: the owner's words if they changed them. */
  const content = edit ?? (draft ? { title: draft.title, body: draft.body } : null);
  const edited = edit !== null;

  /**
   * Whether the current wording could be sent at all.
   *
   * The same `campaignShapeProblem` the confirm endpoint runs and the same
   * bounds `ai_action_apply_campaign_edit` enforces in SQL — so the button is
   * disabled for exactly the reasons the server would refuse, rather than for a
   * second set of rules that happen to look similar.
   */
  const editProblem: EditProblem | null = (() => {
    if (!content) return null;
    const problem = campaignShapeProblem(content.title, content.body);
    if (!problem) return null;
    if (problem === "TITLE_TOO_LONG") return "TITLE_TOO_LONG";
    if (problem === "BODY_TOO_LONG") return "BODY_TOO_LONG";
    return "EMPTY";
  })();

  const approve = useMutation({
    mutationFn: async () => {
      const proposal = query.data;
      if (!proposal) throw new Error("NO_PROPOSAL");
      if (editProblem) throw new Error("EDIT_INVALID");
      // Only send the content field when they actually changed something.
      return confirmProposal(
        proposal.id,
        proposal.nonce,
        edit ? { title: edit.title.trim(), body: edit.body.trim() } : undefined,
      );
    },
    onSuccess: (answer) => {
      if (answer.ok) {
        setResult(answer);
        setFailure(null);
        // The `notifications` root, as a prefix. A campaign writes rows for
        // its recipients rather than for the owner, so strictly nothing of
        // theirs moved — but a shop whose owner is also a customer somewhere
        // has a list keyed by their own user id, and invalidating the root is
        // one cheap call against a hook that has no per-user key to hand.
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } else {
        setFailure(answer);
      }
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
    // the card staying on a live send button after the owner said no.
    onSettled: () => setDeclined(true),
  });

  const stage = ((): CampaignStage => {
    if (!actionId || query.isPending) return "LOADING";
    if (!query.data) return "GONE";
    // A proposal that is not a campaign is not this card's business. The
    // provider registry has no customer prepare tool, so this is unreachable —
    // it is here so that if it ever happened the owner would see nothing rather
    // than a campaign card describing a queue join.
    if (!draft) return "GONE";
    if (result) return "SENT";
    if (failure) return failure.code === "EXPIRED" ? "EXPIRED" : "FAILED";
    if (declined) return "CANCELLED";
    if (approve.isPending) return "EXECUTING";

    // The stored status wins over local state — it is what the server thinks,
    // and a row cancelled or sent in another tab should show that.
    switch (query.data.status) {
      case "EXECUTED":
        return "SENT";
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
    // `expires_at` inside `ai_action_claim()` with its own clock, so an owner
    // whose device clock is wrong cannot approve a lapsed proposal.
    if (new Date(query.data.expiresAt).getTime() <= nowMs) return "EXPIRED";
    return "PROPOSED";
  })();

  const startEditing = useCallback(() => {
    setEditing(true);
    setEdit((current) =>
      current ?? (draft ? { title: draft.title, body: draft.body } : null),
    );
  }, [draft]);

  /** Put the model's draft back, and forget that an edit ever happened. */
  const revertEdit = useCallback(() => {
    setEdit(null);
    setEditing(false);
  }, []);

  return {
    stage,
    proposal: query.data ?? null,
    draft,
    /** The wording that will be sent — the edit if there is one. */
    content,
    edited,
    editing,
    editProblem,
    setEdit,
    startEditing,
    stopEditing: useCallback(() => setEditing(false), []),
    revertEdit,
    result,
    failure,
    approve: approve.mutate,
    cancel: cancel.mutate,
    /** True while a send is in flight — every button's disabled state. */
    busy: approve.isPending || cancel.isPending,
    reset: useCallback(() => {
      setResult(null);
      setFailure(null);
      setDeclined(false);
    }, []),
  };
}
