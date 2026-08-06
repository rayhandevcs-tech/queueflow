"use client";

import { useState } from "react";
import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { TabBar } from "@/components/ui/TabBar";
import { HelpCenterView } from "@/features/support/components/HelpCenterView";
import { MyTicketsView } from "@/features/support/components/MyTicketsView";
import { supportDict } from "@/features/support/lib/i18n";
import { useT } from "@/lib/i18n";

export default function HelpPage() {
  const t = useT(supportDict);
  const [tab, setTab] = useState<"faq" | "tickets">("faq");

  return (
    <SharedPageShell title={t("supportTitle")}>
      <div className="space-y-5">
        <TabBar
          tabs={[
            { id: "faq", label: t("tabFaq") },
            { id: "tickets", label: t("tabTickets") },
          ]}
          active={tab}
          onChange={(id) => setTab(id as "faq" | "tickets")}
        />
        {tab === "faq" ? <HelpCenterView /> : <MyTicketsView />}
      </div>
    </SharedPageShell>
  );
}
