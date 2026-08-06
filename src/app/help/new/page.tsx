"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { NewTicketView } from "@/features/support/components/NewTicketView";
import { supportDict } from "@/features/support/lib/i18n";
import { useT } from "@/lib/i18n";

export default function NewTicketPage() {
  const t = useT(supportDict);
  return (
    <SharedPageShell title={t("newTicket")}>
      <NewTicketView />
    </SharedPageShell>
  );
}
