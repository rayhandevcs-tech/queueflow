"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Star, Store } from "lucide-react";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { BUSINESS_TYPE_LABEL, SHOP_STATUSES } from "@/config/constants";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT, useLanguage } from "@/lib/i18n";
import type { BusinessType, ShopStatus } from "@/types";
import { SHOPS_PAGE_SIZE, useAdminShops, type AdminShopRow } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";
import { SHOP_STATUS_LABEL_KEY } from "../lib/shop-status";
import { ShopStatusBadge } from "./ShopStatusBadge";

interface Props {
  title: string;
  description: string;
  /** Verification queue passes PENDING and hides the status filter. */
  lockedStatus?: ShopStatus;
  initialStatus?: ShopStatus | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ShopsListView({
  title,
  description,
  lockedStatus,
  initialStatus = null,
  emptyTitle,
  emptyDescription,
}: Props) {
  const router = useRouter();
  const t = useT(adminDict);
  const { language } = useLanguage();

  const [status, setStatus] = useState<ShopStatus | null>(lockedStatus ?? initialStatus);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(SHOPS_PAGE_SIZE);

  const { data, isPending, isFetching } = useAdminShops({
    status: lockedStatus ?? status,
    businessType,
    search,
    pageSize,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const hasMore = rows.length < total;

  const columns: DataTableColumn<AdminShopRow>[] = [
    {
      id: "shop",
      header: t("colShop"),
      className: "min-w-[13rem]",
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <AvatarChip label={row.name} avatarUrl={row.logo_url} size={34} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{row.name}</p>
            <p className="truncate text-xs text-muted">
              {BUSINESS_TYPE_LABEL[row.business_type][language]}
              {row.address ? ` · ${row.address}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "owner",
      header: t("colOwner"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{row.owner_name ?? "—"}</p>
          <p className="truncate font-number text-xs text-muted">{row.owner_phone ?? ""}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ShopStatusBadge status={row.status} />
          {row.is_featured && <Badge variant="brass">{t("featured")}</Badge>}
          {row.status === "ACTIVE" && (
            <Badge variant={row.is_open ? "good" : "neutral"}>
              {row.is_open ? t("openNow") : t("closedNow")}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "size",
      header: t("colSize"),
      className: "font-number",
      cell: (row) => `${toBanglaDigits(row.chair_count)} / ${toBanglaDigits(row.service_count)}`,
    },
    {
      id: "activity",
      header: t("colActivity"),
      cell: (row) =>
        row.serials_30d === 0 ? (
          <span className="text-muted">{t("noSerialYet")}</span>
        ) : (
          <div className="font-number">
            <p className="text-ink">{t("serialsShort", row.serials_30d)}</p>
            <p className="text-xs text-muted">৳{formatMoney(Math.round(row.revenue_30d))}</p>
          </div>
        ),
    },
    {
      id: "rating",
      header: t("colRating"),
      cell: (row) =>
        row.review_count === 0 ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="inline-flex items-center gap-1 font-number">
            <Star className="h-3.5 w-3.5 fill-brass text-brass" />
            {row.avg_rating.toFixed(1)}
            <span className="text-xs text-muted">({toBanglaDigits(row.review_count)})</span>
          </span>
        ),
    },
    {
      id: "joined",
      header: t("colJoined"),
      className: "whitespace-nowrap",
      cell: (row) => (
        <span className="text-muted">{formatBanglaDate(new Date(row.created_at))}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />

      <div className="space-y-2.5">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPageSize(SHOPS_PAGE_SIZE);
          }}
          placeholder={t("searchPlaceholder")}
          icon={<Search className="h-4 w-4" />}
          className="max-w-md"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {!lockedStatus && (
            <FilterRow
              label={t("filterStatus")}
              options={[
                { value: null, label: t("filterAll") },
                ...SHOP_STATUSES.map((s) => ({
                  value: s,
                  label: t(SHOP_STATUS_LABEL_KEY[s]),
                })),
              ]}
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPageSize(SHOPS_PAGE_SIZE);
              }}
            />
          )}
          <FilterRow
            label={t("filterType")}
            options={[
              { value: null, label: t("filterAll") },
              { value: "SALON" as const, label: BUSINESS_TYPE_LABEL.SALON[language] },
              { value: "PARLOUR" as const, label: BUSINESS_TYPE_LABEL.PARLOUR[language] },
            ]}
            value={businessType}
            onChange={(next) => {
              setBusinessType(next);
              setPageSize(SHOPS_PAGE_SIZE);
            }}
          />
        </div>

        {!isPending && (
          <p className="font-number text-xs text-muted">{t("resultCount", total)}</p>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/admin/shops/${row.id}`)}
        loading={isPending}
        emptyIcon={<Store className="h-6 w-6" />}
        emptyTitle={emptyTitle ?? t("shopsEmptyTitle")}
        emptyDescription={emptyDescription ?? t("shopsEmptyDesc")}
        mobileCard={(row) => <ShopCard row={row} />}
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

function ShopCard({ row }: { row: AdminShopRow }) {
  const t = useT(adminDict);
  const { language } = useLanguage();

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2.5">
        <AvatarChip label={row.name} avatarUrl={row.logo_url} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold text-ink">{row.name}</p>
          <p className="truncate text-xs text-muted">
            {BUSINESS_TYPE_LABEL[row.business_type][language]}
            {row.address ? ` · ${row.address}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ShopStatusBadge status={row.status} />
        {row.is_featured && <Badge variant="brass">{t("featured")}</Badge>}
        {row.status === "ACTIVE" && (
          <Badge variant={row.is_open ? "good" : "neutral"}>
            {row.is_open ? t("openNow") : t("closedNow")}
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Row label={t("colOwner")} value={row.owner_name ?? "—"} />
        <Row
          label={t("colSize")}
          value={`${toBanglaDigits(row.chair_count)} / ${toBanglaDigits(row.service_count)}`}
        />
        <Row
          label={t("colActivity")}
          value={
            row.serials_30d === 0 ? t("noSerialYet") : t("serialsShort", row.serials_30d)
          }
        />
        <Row
          label={t("colRating")}
          value={row.review_count === 0 ? t("noRatingYet") : row.avg_rating.toFixed(1)}
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted">{label}</dt>
      <dd className="truncate font-medium text-ink">{value}</dd>
    </div>
  );
}

function FilterRow<T extends string>({
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
            key={opt.value ?? "all"}
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
