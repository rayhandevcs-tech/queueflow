"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight } from "lucide-react";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT, useLanguage } from "@/lib/i18n";
import { SHOPS_PAGE_SIZE, useAdminShops, type AdminShopRow } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";
import { ShopStatusActions } from "./ShopStatusActions";

/**
 * A work queue, not a table: oldest submission first (admin_list_shops already
 * sorts PENDING that way), with approve/reject right on the card.
 */
export function VerificationQueueView() {
  const t = useT(adminDict);
  const { language } = useLanguage();
  const { data, isPending } = useAdminShops({
    status: "PENDING",
    businessType: null,
    search: "",
    pageSize: SHOPS_PAGE_SIZE,
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title={t("verificationTitle")} description={t("verificationSubtitle")} />

      {isPending ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="h-6 w-6 text-muted" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<BadgeCheck className="h-6 w-6" />}
          title={t("verificationEmptyTitle")}
          description={t("verificationEmptyDesc")}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <QueueCard row={row} language={language} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueCard({ row, language }: { row: AdminShopRow; language: "bn" | "en" }) {
  const t = useT(adminDict);
  // Everything a shop needs before it can actually serve a customer.
  const ready = row.chair_count > 0 && row.service_count > 0;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <AvatarChip label={row.name} avatarUrl={row.logo_url} size={44} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/shops/${row.id}`}
            className="group flex items-center gap-1 font-display text-[15px] font-bold text-ink hover:text-accent"
          >
            <span className="truncate">{row.name}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
          </Link>
          <p className="truncate text-xs text-muted">
            {BUSINESS_TYPE_LABEL[row.business_type][language]}
            {row.address ? ` · ${row.address}` : ""}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {row.owner_name ?? "—"}
            {row.owner_phone ? ` · ${row.owner_phone}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-[11px] whitespace-nowrap text-muted">
          {formatBanglaDate(new Date(row.created_at))}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
        <Chip ok={row.chair_count > 0}>
          {t("readyChair")} · {toBanglaDigits(row.chair_count)}
        </Chip>
        <Chip ok={row.service_count > 0}>
          {t("readyService")} · {toBanglaDigits(row.service_count)}
        </Chip>
        <Chip ok={!!row.phone}>{t("readyPhone")}</Chip>
      </div>

      {!ready && (
        <p className="rounded-xl bg-live-soft px-3 py-2 text-xs text-live">
          {t("readinessIncompleteHint")}
        </p>
      )}

      <ShopStatusActions
        shopId={row.id}
        status={row.status}
        isFeatured={row.is_featured}
        layout="row"
      />
    </Card>
  );
}

function Chip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
        ok ? "bg-good-soft text-good" : "bg-soft text-muted",
      )}
    >
      {ok ? "✓" : "—"} {children}
    </span>
  );
}
