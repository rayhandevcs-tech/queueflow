"use client";

import { CupSoda } from "lucide-react";
import { useT } from "@/lib/i18n";
import { providerQueueDict } from "../lib/i18n";

export function EmptyLane() {
  const t = useT(providerQueueDict);
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-soft/60 py-7 text-center">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-card text-muted">
        <CupSoda className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{t("noWaitingSerials")}</p>
        <p className="mt-0.5 text-xs text-muted">{t("noWaitingSerialsDesc")}</p>
      </div>
    </div>
  );
}
