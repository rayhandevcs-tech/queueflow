"use client";

import { FloatingChatWidget } from "@/components/ui/FloatingChatWidget";
import { customerHelpDict } from "@/features/customer-help/lib/i18n";
import { useT } from "@/lib/i18n";

/** The customer's labels bound to the shared widget and their help endpoint. */
export function CustomerHelpWidget() {
  const t = useT(customerHelpDict);

  return (
    <FloatingChatWidget
      endpoint="/api/ai/help"
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
