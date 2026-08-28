"use client";

import { FloatingChatWidget } from "@/components/ui/FloatingChatWidget";
import { providerAiDict } from "@/features/provider-ai/lib/i18n";
import { useT } from "@/lib/i18n";

/**
 * The shop's assistant, always within reach.
 *
 * It points at the same endpoint as the full screen at /ai, so the bubble is a
 * shortcut rather than a second feature — the shop brief, the caching and the
 * prompt are all shared. The full page is still where the analysis lives; this
 * is for "how much did I make today" asked in the middle of a shift.
 */
export function ProviderAssistantWidget() {
  const t = useT(providerAiDict);

  return (
    <FloatingChatWidget
      endpoint="/api/ai/chat"
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
        footnote: t("botFootnote"),
        errNotSignedIn: t("errSignedOut"),
        errNoKey: t("errNoKey"),
        errGeneric: t("errGeneric"),
      }}
    />
  );
}
