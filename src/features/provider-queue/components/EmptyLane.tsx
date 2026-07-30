"use client";

import { useT } from "@/lib/i18n";
import { providerQueueDict } from "../lib/i18n";

export function EmptyLane() {
  const t = useT(providerQueueDict);
  return (
    <div className="rounded-2xl border border-dashed border-line py-8.5 text-center text-sm text-muted">
      {t("noWaitingSerials")}
    </div>
  );
}
