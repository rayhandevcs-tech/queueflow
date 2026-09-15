"use client";

import { useMemo } from "react";
import { Share2 } from "lucide-react";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import type { ReferrerStatsRow } from "../api/referral.api";
import { referralDict } from "../lib/i18n";

/**
 * Who brought how many, best first.
 *
 * Ordered by the database — converted referrals, then total claims, then
 * recency — because the one question this table answers is "which of my
 * customers actually brings people", and a claim nobody acted on is not the
 * same achievement as a customer who walked through the door.
 *
 * "Claimed" and "Came" are two columns on purpose. Collapsing them into one
 * number would hide the only interesting gap in the feature: a code that gets
 * typed in and then never used.
 */
export function ReferralStatsTable({
  rows: input,
  isPending,
  isError,
}: {
  rows: ReferrerStatsRow[] | undefined;
  isPending: boolean;
  isError: boolean;
}) {
  const t = useT(referralDict);
  const rows = useMemo(() => input ?? [], [input]);
  const num = (n: number) => toBanglaDigits(n);

  const nameCell = (row: ReferrerStatsRow) => (
    <div className="flex items-center gap-2">
      <AvatarChip label={row.referrerName} shape="circle" size={26} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">{row.referrerName}</p>
        <p className="truncate font-number text-[11px] tracking-wider text-muted">{row.code}</p>
      </div>
    </div>
  );

  const columns: DataTableColumn<ReferrerStatsRow>[] = [
    { id: "referrer", header: t("colReferrer"), cell: nameCell },
    {
      id: "claimed",
      header: t("colBrought"),
      className: "text-right",
      cell: (row) => <span className="font-number text-muted">{num(row.totalReferrals)}</span>,
    },
    {
      id: "came",
      header: t("colCame"),
      className: "text-right",
      cell: (row) => (
        <span className="font-display text-[15px] font-bold text-good">
          {num(row.convertedCount)}
        </span>
      ),
    },
    {
      id: "points",
      header: t("colPoints"),
      className: "text-right",
      cell: (row) => (
        <span className="font-display text-[15px] font-bold text-accent">
          {num(row.pointsAwarded)}
        </span>
      ),
    },
    {
      id: "last",
      header: t("colLast"),
      cell: (row) => (
        <span className="whitespace-nowrap text-muted">
          {row.lastReferralAt ? formatBanglaDate(new Date(row.lastReferralAt)) : "—"}
        </span>
      ),
    },
  ];

  if (isError) {
    return <p className="py-10 text-center text-sm text-live">{t("loadFailed")}</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">{t("tableHeading")}</h2>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.referrerId}
        loading={isPending}
        emptyIcon={<Share2 className="h-6 w-6" />}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyBody")}
        mobileCard={(row) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">{nameCell(row)}</div>
            <div className="shrink-0 text-right">
              <p className="font-display text-[15px] font-bold text-good">
                {num(row.convertedCount)} / {num(row.totalReferrals)}
              </p>
              <p className="text-[10px] text-muted">{t("points", num(row.pointsAwarded))}</p>
            </div>
          </div>
        )}
      />
    </div>
  );
}
