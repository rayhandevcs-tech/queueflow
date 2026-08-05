"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldOff, Store, Users } from "lucide-react";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { UserRole } from "@/types";
import { SHOPS_PAGE_SIZE, useAdminUsers, type AdminUserRow } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

export function UsersListView() {
  const router = useRouter();
  const t = useT(adminDict);

  const [role, setRole] = useState<UserRole | null>(null);
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(SHOPS_PAGE_SIZE);

  const { data, isPending, isFetching } = useAdminUsers({ role, blocked, search, pageSize });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const hasMore = rows.length < total;

  const reset = () => setPageSize(SHOPS_PAGE_SIZE);

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      id: "user",
      header: t("colUser"),
      className: "min-w-[12rem]",
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <AvatarChip label={row.full_name} avatarUrl={row.avatar_url} shape="circle" size={32} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{row.full_name}</p>
            <p className="truncate text-xs text-muted">
              {formatBanglaDate(new Date(row.created_at))}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: t("colRole"),
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={row.role === "provider" ? "accent" : "neutral"}>
            {row.role === "provider" ? t("roleProvider") : t("roleCustomer")}
          </Badge>
          {row.shop_name && <span className="truncate text-xs text-muted">{row.shop_name}</span>}
        </div>
      ),
    },
    {
      id: "contact",
      header: t("colContact"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-number text-ink">{row.phone ?? "—"}</p>
          <p className="truncate text-xs text-muted">{row.email ?? ""}</p>
        </div>
      ),
    },
    {
      id: "history",
      header: t("colHistory"),
      className: "font-number",
      cell: (row) => (
        <span className={row.no_shows > 0 ? "text-live" : "text-ink"}>
          {toBanglaDigits(row.serials_total)} / {toBanglaDigits(row.no_shows)}
        </span>
      ),
    },
    {
      id: "spend",
      header: t("colSpend"),
      className: "font-number",
      cell: (row) => (
        <div>
          <p className="text-ink">৳{formatMoney(Math.round(row.spend_total))}</p>
          {row.due_total > 0 && (
            <p className="text-xs text-live">৳{formatMoney(Math.round(row.due_total))}</p>
          )}
        </div>
      ),
    },
    {
      id: "flags",
      header: t("colFlags"),
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.blocked_at && <Badge variant="live">{t("blockedBadge")}</Badge>}
          {row.reports_against > 0 && (
            <Badge variant="brass">{t("reportsAgainstBadge", row.reports_against)}</Badge>
          )}
          {!row.blocked_at && row.reports_against === 0 && <span className="text-muted">—</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t("usersTitle")} description={t("usersSubtitle")} />

      <div className="space-y-2.5">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            reset();
          }}
          placeholder={t("userSearchPlaceholder")}
          icon={<Search className="h-4 w-4" />}
          className="max-w-md"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <Filters
            label={t("filterRole")}
            options={[
              { value: null, label: t("filterAll") },
              { value: "customer" as const, label: t("roleCustomer") },
              { value: "provider" as const, label: t("roleProvider") },
            ]}
            value={role}
            onChange={(next) => {
              setRole(next);
              reset();
            }}
          />
          <Filters
            label={t("filterAccess")}
            options={[
              { value: null, label: t("filterAll") },
              { value: true, label: t("accessBlocked") },
              { value: false, label: t("accessActive") },
            ]}
            value={blocked}
            onChange={(next) => {
              setBlocked(next);
              reset();
            }}
          />
        </div>

        {!isPending && (
          <p className="font-number text-xs text-muted">{t("userCountResult", total)}</p>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
        loading={isPending}
        emptyIcon={<Users className="h-6 w-6" />}
        emptyTitle={t("usersEmptyTitle")}
        emptyDescription={t("usersEmptyDesc")}
        mobileCard={(row) => <UserCard row={row} />}
      />

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="soft"
            loading={isFetching}
            onClick={() => setPageSize((size) => size + SHOPS_PAGE_SIZE)}
          >
            {t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

function UserCard({ row }: { row: AdminUserRow }) {
  const t = useT(adminDict);

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2.5">
        <AvatarChip label={row.full_name} avatarUrl={row.avatar_url} shape="circle" size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold text-ink">{row.full_name}</p>
          <p className="truncate font-number text-xs text-muted">{row.phone ?? row.email ?? ""}</p>
        </div>
        {row.blocked_at && (
          <ShieldOff className="h-4 w-4 shrink-0 text-live" aria-label={t("blockedBadge")} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={row.role === "provider" ? "accent" : "neutral"}>
          {row.role === "provider" ? t("roleProvider") : t("roleCustomer")}
        </Badge>
        {row.shop_name && (
          <Badge variant="neutral">
            <Store className="h-3 w-3" />
            {row.shop_name}
          </Badge>
        )}
        {row.reports_against > 0 && (
          <Badge variant="brass">{t("reportsAgainstBadge", row.reports_against)}</Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Cell
          label={t("colHistory")}
          value={`${toBanglaDigits(row.serials_total)} / ${toBanglaDigits(row.no_shows)}`}
          alert={row.no_shows > 0}
        />
        <Cell label={t("colSpend")} value={`৳${formatMoney(Math.round(row.spend_total))}`} />
      </dl>
    </div>
  );
}

function Cell({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted">{label}</dt>
      <dd className={cn("truncate font-medium", alert ? "text-live" : "text-ink")}>{value}</dd>
    </div>
  );
}

function Filters<T extends string | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T | null; label: string }>;
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors",
              selected
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-card text-muted hover:bg-soft",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
