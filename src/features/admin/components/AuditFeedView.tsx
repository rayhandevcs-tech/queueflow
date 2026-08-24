"use client";

import { useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { useLanguage, useT, type Language } from "@/lib/i18n";
import { useAuditFeed, type AdminAuditRow } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

/**
 * Every action string admin_log() can write, with its label.
 *
 * These are the log's own vocabulary — they exist nowhere else in the product,
 * so they live here rather than in the shared dict. The keys must match the
 * literals the RPCs pass to admin_log(); anything unrecognised still renders,
 * as its raw key, because a log that hides what it doesn't know is worse than
 * one that occasionally looks technical.
 */
const ACTION_LABEL: Record<string, { bn: string; en: string }> = {
  SHOP_STATUS: { bn: "দোকানের অবস্থা বদল", en: "Shop status changed" },
  SHOP_FEATURED: { bn: "দোকান ফিচার্ড", en: "Shop featured" },
  USER_BLOCKED: { bn: "ইউজার ব্লক", en: "User blocked" },
  USER_UNBLOCKED: { bn: "ব্লক তুলে নেওয়া", en: "User unblocked" },
  USER_PROFILE_EDITED: { bn: "প্রোফাইল সম্পাদনা", en: "Profile edited" },
  USER_DELETED: { bn: "একাউন্ট ডিলিট", en: "Account deleted" },
  SERIAL_FORCE_CANCELLED: { bn: "সিরিয়াল জোর করে বাতিল", en: "Serial force-cancelled" },
  REVIEW_HIDDEN: { bn: "রিভিউ লুকানো", en: "Review hidden" },
  REVIEW_UNHIDDEN: { bn: "রিভিউ ফেরানো", en: "Review restored" },
  REPORT_RESOLVED: { bn: "রিপোর্ট নিষ্পত্তি", en: "Report resolved" },
  REPORT_DISMISSED: { bn: "রিপোর্ট খারিজ", en: "Report dismissed" },
  REPORT_OPEN: { bn: "রিপোর্ট আবার খোলা", en: "Report reopened" },
  ADMIN_SET_STATUS: { bn: "এডমিনের অবস্থা বদল", en: "Admin status changed" },
  ADMIN_SET_LEVEL: { bn: "এডমিনের স্তর বদল", en: "Admin level changed" },
  ADMIN_REVOKE: { bn: "এডমিন সরানো", en: "Admin revoked" },
  SUPPORT_REPLY: { bn: "সাপোর্টে উত্তর", en: "Support reply" },
  SUPPORT_SET_STATUS: { bn: "টিকিটের অবস্থা বদল", en: "Ticket status changed" },
};

const ACTIONS = Object.keys(ACTION_LABEL);

/**
 * The one meta field worth putting on the headline, per action.
 *
 * Every RPC writes a different shape — SHOP_STATUS has `to`, the admin ones
 * have `status` / `level`, SHOP_FEATURED has a boolean `featured`. Naming the
 * field per action beats guessing across all of them.
 */
const OUTCOME_KEY: Record<string, string> = {
  SHOP_STATUS: "to",
  SHOP_FEATURED: "featured",
  ADMIN_SET_STATUS: "status",
  ADMIN_SET_LEVEL: "level",
  SUPPORT_SET_STATUS: "status",
};

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
            {labelFor(a, language)}
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
            <AuditRow key={row.id} row={row} language={language} />
          ))}
        </ul>
      )}
    </div>
  );
}

function labelFor(action: string, language: Language): string {
  return ACTION_LABEL[action]?.[language] ?? action;
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

function AuditRow({ row, language }: { row: AdminAuditRow; language: Language }) {
  const t = useT(adminDict);

  // Whichever of reason / note the action happened to record — both are the
  // admin's own words about why, and only one is ever set.
  const why =
    (typeof row.meta?.reason === "string" && row.meta.reason) ||
    (typeof row.meta?.note === "string" && row.meta.note) ||
    null;

  const outcomeKey = OUTCOME_KEY[row.action];
  const outcomeRaw = outcomeKey ? row.meta?.[outcomeKey] : undefined;
  const outcome =
    typeof outcomeRaw === "boolean"
      ? outcomeRaw
        ? t("auditYes")
        : t("auditNo")
      : typeof outcomeRaw === "string" || typeof outcomeRaw === "number"
        ? String(outcomeRaw)
        : null;

  // 'admin' targets are user ids too, so they open the same user page.
  const href =
    row.target_type === "shop" && row.target_id
      ? `/admin/shops/${row.target_id}`
      : (row.target_type === "user" || row.target_type === "admin") && row.target_id
        ? `/admin/users/${row.target_id}`
        : null;

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {labelFor(row.action, language)}
          {row.target_name && <span className="font-normal text-muted"> · {row.target_name}</span>}
          {outcome && <span className="font-normal text-muted"> → {outcome}</span>}
        </p>
        <p className="truncate text-[11px] text-muted">
          {[row.actor_name ?? t("auditSystemActor"), why].filter(Boolean).join(" · ")}
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
