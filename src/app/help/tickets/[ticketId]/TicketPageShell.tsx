"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { TicketThreadView } from "@/features/support/components/TicketThreadView";
import { supportDict } from "@/features/support/lib/i18n";
import { useT } from "@/lib/i18n";

/**
 * The page itself is a server component (it awaits `params`), so the shell —
 * which needs the language context and the profile query to pick the right
 * chrome — lives here.
 */
export function TicketPageShell({ ticketId }: { ticketId: string }) {
  const t = useT(supportDict);
  return (
    <SharedPageShell title={t("supportTitle")}>
      <TicketThreadView ticketId={ticketId} />
    </SharedPageShell>
  );
}
