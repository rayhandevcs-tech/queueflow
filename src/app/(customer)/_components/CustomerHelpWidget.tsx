"use client";

import { FloatingChatWidget } from "@/components/ui/FloatingChatWidget";
import { AiProposalCard } from "@/features/customer-ai/components/AiProposalCard";
import { customerHelpDict } from "@/features/customer-help/lib/i18n";
import { useT } from "@/lib/i18n";

/**
 * The customer's labels bound to the shared widget and the agent endpoint.
 *
 * The endpoint moved from `/api/ai/help` to `/api/ai/agent`, which is the whole
 * of the Sprint 2 UI change — the widget, the streaming hook, the error codes
 * and the labels are untouched, because the agent route answers with the same
 * `text/plain` contract on purpose.
 *
 * `/api/ai/help` is deliberately still live and still passing its tests. It
 * answers from a pre-built brief with no tools, so if the agent turns out to be
 * slower or chattier than a help desk should be, reverting is this one string.
 * The agent prompt includes the same product knowledge, so nothing a customer
 * could previously ask has stopped working.
 */
export function CustomerHelpWidget() {
  const t = useT(customerHelpDict);

  return (
    <FloatingChatWidget
      endpoint="/api/ai/agent"
      // AI Sprint 3. When a turn prepares a queue join — or, since Sprint 4, a
      // booking or a redemption — the card appears under the answer with the
      // confirm button on it. The widget passes only the id; the card reads the
      // proposal from the database under RLS, so the figures the customer
      // agrees to are the ones the server stored.
      //
      // The provider widget passes its OWN card from Sprint 5, and what keeps
      // the two apart is the registry rather than this line: a customer's tool
      // slice has no `prepare_campaign_send` and an owner's has no
      // `prepare_join_queue`, so neither session can produce the other's
      // proposal in the first place.
      renderProposal={(proposalId) => <AiProposalCard actionId={proposalId} />}
      labels={{
        name: t("botName"),
        subtitle: t("botSubtitle"),
        openLabel: t("openLabel"),
        closeLabel: t("closeLabel"),
        greeting: t("greeting"),
        suggestions: [t("suggestion1"), t("suggestion2"), t("suggestion3"), t("suggestion4")],
        placeholder: t("placeholder"),
        sendLabel: t("sendLabel"),
        stopLabel: t("stopLabel"),
        footnote: t("notTheShopNote"),
        errNotSignedIn: t("errSignedOut"),
        errNoKey: t("errNoKey"),
        errGeneric: t("errGeneric"),
      }}
    />
  );
}
