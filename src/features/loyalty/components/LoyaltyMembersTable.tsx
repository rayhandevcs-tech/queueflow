"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { LoyaltyAccount } from "@/types";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import type { LoyaltyCustomerInfo } from "../api/loyalty.api";
import { loyaltyDict } from "../lib/i18n";

/**
 * Who has what, biggest balance first.
 *
 * Ordered by the database, not re-sorted here: the one thing an owner wants
 * from this table is "who are my best customers", and `(shop_id, balance
 * desc)` is indexed for exactly that.
 *
 * The names come from a second query and may arrive after the balances. A row
 * that shows a balance for a moment before its name is better than a table
 * that waits for the shop's entire work history to load.
 */
export function LoyaltyMembersTable({
  accounts,
  names,
  isPending,
  isError,
  onOpen,
}: {
  accounts: LoyaltyAccount[] | undefined;
  names: Map<string, LoyaltyCustomerInfo> | undefined;
  isPending: boolean;
  isError: boolean;
  onOpen: (account: LoyaltyAccount) => void;
}) {
  const t = useT(loyaltyDict);
  const rows = useMemo(() => accounts ?? [], [accounts]);
  const num = (n: number) => toBanglaDigits(n);
  const info = (id: string) => names?.get(id);

  const nameCell = (row: LoyaltyAccount) => {
    const person = info(row.customer_id);
    return (
      <div className="flex items-center gap-2">
        <AvatarChip
          label={person?.name}
          avatarUrl={person?.avatarUrl ?? null}
          shape="circle"
          size={26}
        />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{person?.name || t("noName")}</p>
          {person?.phone && (
            <p className="truncate font-number text-[11px] text-muted">{person.phone}</p>
          )}
        </div>
      </div>
    );
  };

  const balanceCell = (row: LoyaltyAccount) => (
    <p className="font-display text-[15px] font-bold whitespace-nowrap text-accent">
      {num(row.balance)}
    </p>
  );

  const columns: DataTableColumn<LoyaltyAccount>[] = [
    { id: "customer", header: t("colCustomer"), cell: nameCell },
    { id: "balance", header: t("colBalance"), className: "text-right", cell: balanceCell },
    {
      id: "lifetime",
      header: t("colLifetime"),
      className: "text-right",
      cell: (row) => (
        <span className="font-number text-muted">{num(row.lifetime_earned)}</span>
      ),
    },
    {
      id: "updated",
      header: t("colLastEarned"),
      cell: (row) => (
        <span className="whitespace-nowrap text-muted">
          {formatBanglaDate(new Date(row.updated_at))}
        </span>
      ),
    },
  ];

  if (isError) {
    return <p className="py-10 text-center text-sm text-live">{t("loadFailed")}</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">{t("membersHeading")}</h2>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => `${row.shop_id}-${row.customer_id}`}
        loading={isPending}
        onRowClick={onOpen}
        emptyIcon={<Sparkles className="h-6 w-6" />}
        emptyTitle={t("noMembersTitle")}
        emptyDescription={t("noMembersDesc")}
        mobileCard={(row) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">{nameCell(row)}</div>
            <div className="shrink-0 text-right">
              {balanceCell(row)}
              <p className="text-[10px] text-muted">
                {t("cardLifetime", num(row.lifetime_earned))}
              </p>
            </div>
          </div>
        )}
      />
    </div>
  );
}
