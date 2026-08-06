"use client";

import { StatusPill } from "@/components/ui/StatusPill";
import { SUPPORT_STATUS_LABEL } from "@/config/constants";
import { useT } from "@/lib/i18n";
import type { SupportStatus } from "@/types";

/**
 * Lives in shared rather than in either feature because the customer's ticket
 * list and the admin's Support Center must agree on what "চলছে" looks like —
 * the same lifecycle read two different colours would be a bug the eye finds
 * before the tests do.
 */
const TONE: Record<SupportStatus, "brass" | "accent" | "good" | "neutral"> = {
  PENDING: "brass",
  IN_PROGRESS: "accent",
  SOLVED: "good",
  CLOSED: "neutral",
};

export function SupportStatusBadge({
  status,
  className,
}: {
  status: SupportStatus;
  className?: string;
}) {
  const t = useT(SUPPORT_STATUS_LABEL);
  return (
    <StatusPill
      tone={TONE[status]}
      label={t(status)}
      pulse={status === "IN_PROGRESS"}
      className={className}
    />
  );
}
