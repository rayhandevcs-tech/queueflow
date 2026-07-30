"use client";

import { SharedPageShell } from "@/app/_components/SharedPageShell";
import { HelpCenterView } from "@/features/support/components/HelpCenterView";

export default function HelpPage() {
  return (
    <SharedPageShell title="হেল্প সেন্টার">
      <HelpCenterView />
    </SharedPageShell>
  );
}
