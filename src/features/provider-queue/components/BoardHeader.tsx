"use client";

import { UserPlus } from "lucide-react";
import { formatBanglaDate } from "@/lib/format-wait";
import { Button } from "@/components/ui/Button";
import { LiveDot } from "@/components/ui/LiveDot";
import { useLanguage, useT } from "@/lib/i18n";
import { providerQueueDict } from "../lib/i18n";

interface Props {
  totals: { waiting: number; inProgress: number };
  onWalkIn: () => void;
  /**
   * The shop-break control, injected by the app layer. It belongs to
   * provider-catalog (it owns the shop row and its mutations) and features
   * may not import each other, so the page composes the two.
   */
  breakSlot?: React.ReactNode;
}

export function BoardHeader({ totals, onWalkIn, breakSlot }: Props) {
  const waitingTotal = totals.waiting + totals.inProgress;
  const { language } = useLanguage();
  const t = useT(providerQueueDict);

  const today =
    language === "en"
      ? new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
      : formatBanglaDate(new Date());

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("liveQueueHeading")}</h1>
        <p className="mt-1 text-sm text-muted">{t("todaySummary", today, waitingTotal)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-full bg-live-soft px-3.25 py-1.75 text-xs font-semibold text-live">
          <LiveDot />
          {t("realtimeUpdating")}
        </span>
        {/* Right where the owner already is when he needs to step away. */}
        {breakSlot}
        <Button onClick={onWalkIn}>
          <UserPlus className="h-4 w-4" />
          {t("walkInCta")}
        </Button>
      </div>
    </div>
  );
}
