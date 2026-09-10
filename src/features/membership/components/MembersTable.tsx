"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import type { CustomerMembership, MembershipStatus } from "@/types";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { membershipDict } from "../lib/i18n";
import {
  daysLeft,
  effectiveStatus,
  isExpiringSoon,
  sortMembershipsForOwner,
  soldAs,
} from "../lib/membership";

type Filter = "all" | "pending" | "active" | "expiring" | "ended";

const STATUS_TONE: Record<MembershipStatus, "neutral" | "accent" | "good" | "brass"> = {
  PENDING: "brass",
  ACTIVE: "good",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
};

const STATUS_KEY = {
  PENDING: "statusPENDING",
  ACTIVE: "statusACTIVE",
  EXPIRED: "statusEXPIRED",
  CANCELLED: "statusCANCELLED",
} as const satisfies Record<MembershipStatus, string>;

/**
 * Who is a member.
 *
 * Ranked rather than sorted by date: a pending request is the one row that
 * needs the owner to *do* something, so it sits at the top even if it arrived
 * a month ago, and live memberships follow in the order they will lapse.
 *
 * Every status shown is the *effective* one — an ACTIVE row whose term ran
 * out last night reads EXPIRED here without waiting for the nightly job.
 */
export function MembersTable({
  memberships,
  isPending,
  isError,
  onOpen,
}: {
  memberships: CustomerMembership[] | undefined;
  isPending: boolean;
  isError: boolean;
  onOpen: (membership: CustomerMembership) => void;
}) {
  const t = useT(membershipDict);
  const [filter, setFilter] = useState<Filter>("all");
  // One clock for the whole table, read once, so two rows can never be judged
  // against timestamps a render apart. Day granularity is all this needs —
  // the offers page reads its clock the same way.
  const [now] = useState(() => new Date());

  const rows = useMemo(() => {
    const ranked = sortMembershipsForOwner(memberships ?? [], now);
    return ranked.filter((row) => {
      const status = effectiveStatus(row, now);
      switch (filter) {
        case "all":
          return true;
        case "pending":
          return status === "PENDING";
        case "active":
          return status === "ACTIVE";
        case "expiring":
          return isExpiringSoon(row, now);
        case "ended":
          return status === "EXPIRED" || status === "CANCELLED";
      }
    });
  }, [memberships, filter, now]);

  const statusCell = (row: CustomerMembership) => {
    const status = effectiveStatus(row, now);
    const left = daysLeft(row, now);
    return (
      <div className="space-y-0.5">
        <StatusPill
          tone={STATUS_TONE[status]}
          dot={status === "ACTIVE"}
          pulse={false}
          label={t(STATUS_KEY[status])}
        />
        {status === "ACTIVE" && left !== null && (
          <p className={cn("text-[10px]", left <= 7 ? "text-brass" : "text-muted")}>
            {t("daysLeft", toBanglaDigits(left))}
          </p>
        )}
      </div>
    );
  };

  const paidCell = (row: CustomerMembership) => (
    <div className="text-right">
      <p className="font-display text-[15px] font-bold whitespace-nowrap text-ink">
        ৳{formatMoney(row.price)}
      </p>
      <span
        className={cn(
          "text-[10px] font-semibold",
          row.payment_status === "PAID" ? "text-good" : "text-brass",
        )}
      >
        {row.payment_status === "PAID" ? t("paidTag") : t("unpaidTag")}
      </span>
    </div>
  );

  const columns: DataTableColumn<CustomerMembership>[] = [
    {
      id: "member",
      header: t("colMember"),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <AvatarChip
            label={row.customer_name}
            avatarUrl={row.customer_avatar_url}
            shape="circle"
            size={26}
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{row.customer_name || t("noName")}</p>
            {row.customer_phone && (
              <p className="truncate font-number text-[11px] text-muted">{row.customer_phone}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "tier",
      header: t("colTier"),
      // The snapshot, never the tier row: this is the package they bought,
      // under the name and at the price it had that day.
      cell: (row) => <span className="text-muted">{soldAs(row).name || "—"}</span>,
    },
    { id: "status", header: t("colStatus"), cell: statusCell },
    { id: "paid", header: t("colPaid"), className: "text-right", cell: paidCell },
    {
      id: "started",
      header: t("colStarted"),
      cell: (row) => (
        <span className="whitespace-nowrap text-muted">
          {row.started_at ? formatBanglaDate(new Date(row.started_at)) : "—"}
        </span>
      ),
    },
    {
      id: "expires",
      header: t("colExpires"),
      cell: (row) => (
        <span className="whitespace-nowrap text-muted">
          {row.expires_at ? formatBanglaDate(new Date(row.expires_at)) : "—"}
        </span>
      ),
    },
  ];

  if (isError) {
    return <p className="py-10 text-center text-sm text-live">{t("membersLoadFailed")}</p>;
  }

  const FILTERS: readonly { id: Filter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "pending", label: t("filterPending") },
    { id: "active", label: t("filterActive") },
    { id: "expiring", label: t("filterExpiring") },
    { id: "ended", label: t("filterEnded") },
  ];

  const noneAtAll = (memberships?.length ?? 0) === 0;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-ink">{t("membersHeading")}</h2>

      {!noneAtAll && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
                filter === option.id
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-card text-muted hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={isPending}
        onRowClick={onOpen}
        emptyIcon={<Users className="h-6 w-6" />}
        emptyTitle={noneAtAll ? t("noMembersTitle") : t("noFilterMatch")}
        emptyDescription={noneAtAll ? t("noMembersDesc") : t("noFilterMatchDesc")}
        mobileCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <AvatarChip
                label={row.customer_name}
                avatarUrl={row.customer_avatar_url}
                shape="circle"
                size={34}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {row.customer_name || t("noName")}
                </p>
                <p className="truncate text-[11px] text-muted">{soldAs(row).name || "—"}</p>
              </div>
              {statusCell(row)}
            </div>
            <div className="flex items-end justify-between gap-2 border-t border-line pt-2">
              <p className="text-[11px] text-muted">
                {row.expires_at ? formatBanglaDate(new Date(row.expires_at)) : "—"}
              </p>
              {paidCell(row)}
            </div>
          </div>
        )}
      />
    </div>
  );
}
