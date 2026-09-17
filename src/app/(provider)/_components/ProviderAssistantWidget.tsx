"use client";

import { FloatingChatWidget } from "@/components/ui/FloatingChatWidget";
import { AiCampaignProposalCard } from "@/features/provider-ai/components/AiCampaignProposalCard";
import { providerAiDict } from "@/features/provider-ai/lib/i18n";
import { useT } from "@/lib/i18n";

/**
 * The shop's assistant, always within reach.
 *
 * It points at the same endpoint as the full screen at /ai, so the bubble is a
 * shortcut rather than a second feature — the prompt, the tools and the limits
 * are all shared. The full page is still where the analysis lives; this is for
 * "how much did I make today" asked in the middle of a shift.
 *
 * AI Sprint 1 moved both surfaces from `/api/ai/chat` to `/api/ai/agent`. The
 * difference is where the numbers come from: `/chat` received one fixed
 * six-month brief and could not ask for anything else, so "compare this week
 * with last week" was unanswerable — the second window was not in the brief.
 * The agent calls an analytics tool per window instead.
 *
 * `/api/ai/chat` is deliberately left in place and working. It is the rollback:
 * if the agent misbehaves, this is a one-line revert rather than a redeploy of
 * the assistant.
 */
export function ProviderAssistantWidget() {
  const t = useT(providerAiDict);

  return (
    <FloatingChatWidget
      endpoint="/api/ai/agent"
      // AI Sprint 5. When a turn prepares a retention campaign, the approval
      // card appears under the answer with Edit, Cancel and Approve & Send on
      // it. The widget passes only the id; the card reads the proposal from
      // the database under RLS, so the group, the count and the message the
      // owner approves are the ones the server stored.
      //
      // Until this sprint the provider widget deliberately passed nothing
      // here, and the customer one did — that comment described the role
      // separation as a UI fact. It never was: the registry is what enforces
      // it, and it still does. An owner's tool slice has no
      // `prepare_join_queue` and a customer's has no `prepare_campaign_send`,
      // so neither session can produce the other's proposal. Each app now
      // renders the card for the proposals its own role can create.
      renderProposal={(proposalId) => (
        <AiCampaignProposalCard actionId={proposalId} />
      )}
      labels={{
        name: t("botName"),
        subtitle: t("botSubtitle"),
        openLabel: t("openLabel"),
        closeLabel: t("closeLabel"),
        greeting: t("greeting"),
        suggestions: [t("suggestion1"), t("suggestion2"), t("suggestion3"), t("suggestion4")],
        placeholder: t("chatPlaceholder"),
        sendLabel: t("chatSend"),
        stopLabel: t("stopLabel"),
        micLabel: t("micLabel"),
        micStopLabel: t("micStopLabel"),
        micHint: t("micHint"),
        micDenied: t("micDenied"),
        listenLabel: t("listenLabel"),
        listenStopLabel: t("listenStopLabel"),
        footnote: t("botFootnote"),
        errNotSignedIn: t("errSignedOut"),
        errNoKey: t("errNoKey"),
        errGeneric: t("errGeneric"),
      }}
    />
  );
}
