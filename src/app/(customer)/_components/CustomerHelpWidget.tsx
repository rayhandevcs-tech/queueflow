"use client";

import { FloatingChatWidget } from "@/components/ui/FloatingChatWidget";
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
