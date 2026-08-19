"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Store } from "lucide-react";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useLanguage, useT } from "@/lib/i18n";
import { useRecentShops, type AdminRecentShop } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

type Tab = "all" | "incomplete";

/**
 * Who has registered lately.
 *
 * This screen replaced the approval queue. Shops now go live the moment they
 * register, so there is no decision waiting here — the job is to notice. A
 * shop with no staff, no service or no map pin cannot serve anyone, which is
 * both the cheapest sign of an abandoned signup and the cheapest sign of abuse,
 * so those are one tab away.
 */
export function RecentShopsView() {
  const t = useT(adminDict);
  const [tab, setTab] = useState<Tab>("all");
  const { data, isPending } = useRecentShops(30);

  const rows = useMemo(() => data ?? [], [data]);
  const incompleteCount = useMemo(() => rows.filter((r) => r.incomplete).length, [rows]);
  const visible = tab === "all" ? rows : rows.filter((r) => r.incomplete);

  return (
    <div className="space-y-5">
      <PageHeader title={t("recentShopsTitle")} description={t("recentShopsSubtitle")} />

      <div className="flex gap-1.5 rounded-xl bg-soft p-1">
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          {t("recentTabAll")} · {toBanglaDigits(rows.length)}
        </TabButton>
        <TabButton active={tab === "incomplete"} onClick={() => setTab("incomplete")}>
          {t("recentTabIncomplete")} · {toBanglaDigits(incompleteCount)}
        </TabButton>
      </div>

      {isPending ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="h-6 w-6 text-muted" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title={tab === "all" ? t("recentEmptyTitle") : t("recentAllCompleteTitle")}
          description={tab === "all" ? t("recentEmptyBody") : t("recentAllCompleteBody")}
        />
      ) : (
        <ul className="space-y-2.5">
          {visible.map((shop) => (
            <RecentShopCard key={shop.id} shop={shop} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
        active ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function RecentShopCard({ shop }: { shop: AdminRecentShop }) {
  const t = useT(adminDict);
  const { language } = useLanguage();

  return (
    <li>
      <Link
        href={`/admin/shops/${shop.id}`}
        className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 transition-colors hover:border-accent/40"
      >
        <AvatarChip label={shop.name} avatarUrl={shop.logo_url} shape="rounded" size={44} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-ink">{shop.name}</p>
            {shop.incomplete && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-brass-soft px-2 py-0.5 text-[10px] font-bold text-brass">
                <AlertTriangle className="h-3 w-3" />
                {t("incompleteTag")}
              </span>
            )}
            {shop.status !== "ACTIVE" && (
              <span className="shrink-0 rounded-full bg-live-soft px-2 py-0.5 text-[10px] font-bold text-live">
                {shop.status}
              </span>
            )}
          </div>

          <p className="truncate text-[11px] text-muted">
            {[shop.owner_name, shop.owner_email].filter(Boolean).join(" · ") || "—"}
          </p>

          <p className="mt-1 truncate text-[11px] text-muted">
            {BUSINESS_TYPE_LABEL[shop.business_type][language]} ·{" "}
            {t("recentCounts", shop.chairs, shop.services, shop.serials)} ·{" "}
            {formatBanglaDate(new Date(shop.created_at))}
          </p>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
