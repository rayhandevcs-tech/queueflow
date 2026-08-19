"use client";

import { useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { useLanguage, useT } from "@/lib/i18n";
import { useAuditFeed, type AdminAuditRow } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

/**
 * The actions worth filtering by, with their labels.
 *
 * Kept here rather than in the shared dict because these strings are the log's
 * vocabulary — they exist only on this screen, and an action the log knows
 * about but this map doesn't should still render (as its raw key) instead of
 * disappearing.
 */
const ACTION_LABEL: Record<string, { bn: string; en: string }> = {
  shop_status_change: { bn: "দোকানের অবস্থা বদল", en: "Shop status changed" },
  user_block: { bn: "ইউজার ব্লক", en: "User blocked" },
  user_unblock: { bn: "ব্লক তুলে নেওয়া", en: "User unblocked" },
  review_hide: { bn: "রিভিউ লুকানো", en: "Review hidden" },
  report_resolve: { bn: "রিপোর্ট নিষ্পত্তি", en: "Report resolved" },
  admin_grant: { bn: "এডমিন বানানো", en: "Admin granted" },
  admin_revoke: { bn: "এডমিন সরানো", en: "Admin revoked" },
  user_delete: { bn: "একাউন্ট ডিলিট", en: "Account deleted" },
};

const ACTIONS = Object.keys(ACTION_LABEL);

/**
 * Every admin action, newest first.
 *
 * admin_audit_log has been written to since the panel was built, but there was
 * no screen for it — reading it meant opening the SQL editor. That mattered
 * less while an admin had to approve each shop by hand and the trail was
 * mostly routine. Now that shops go live on their own, a human touching a shop
 * or an account is the exception, and exceptions are exactly what wants a
 * record someone can actually look at.
 */
export function AuditFeedView() {
  const t = useT(adminDict);
  const { language } = useLanguage();
  const [action, setAction] = useState<string | null>(null);
  const { data, isPending } = useAuditFeed(action);

  // Unknown actions render as their raw key rather than blank — a log that
  // hides what it doesn't recognise is worse than one that looks technical.
  const label = (a: string) => ACTION_LABEL[a]?.[language] ?? a;

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title={t("auditTitle")} description={t("auditSubtitle")} />

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={action === null} onClick={() => setAction(null)}>
          {t("auditFilterAll")}
        </FilterChip>
        {ACTIONS.map((a) => (
          <FilterChip key={a} active={action === a} onClick={() => setAction(a)}>
            {label(a)}
          </FilterChip>
        ))}
      </div>

      {isPending ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="h-6 w-6 text-muted" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" />}
          title={t("auditEmptyTitle")}
          description={t("auditEmptyBody")}
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {rows.map((row) => (
            <AuditRow key={row.id} row={row} label={label(row.action)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
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
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-accent bg-accent text-accent-ink"
          : "border-line bg-card text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function AuditRow({ row, label }: { row: AdminAuditRow; label: string }) {
  const t = useT(adminDict);
  const reason = typeof row.meta?.reason === "string" ? row.meta.reason : null;
  const to = typeof row.meta?.to === "string" ? row.meta.to : null;

  const href =
    row.target_type === "shop" && row.target_id
      ? `/admin/shops/${row.target_id}`
      : row.target_type === "user" && row.target_id
        ? `/admin/users/${row.target_id}`
        : null;

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {label}
          {row.target_name && <span className="font-normal text-muted"> · {row.target_name}</span>}
          {to && <span className="font-normal text-muted"> → {to}</span>}
        </p>
        <p className="truncate text-[11px] text-muted">
          {[row.actor_name ?? t("auditSystemActor"), reason].filter(Boolean).join(" · ")}
        </p>
      </div>
      <time className="shrink-0 text-[11px] text-muted">
        {new Date(row.created_at).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </time>
    </>
  );

  return (
    <li className="border-b border-line last:border-0">
      {href ? (
        <Link href={href} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-soft">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 p-3.5">{body}</div>
      )}
    </li>
  );
}
