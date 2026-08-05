"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Flag, Star, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { TabBar } from "@/components/ui/TabBar";
import { useToast } from "@/components/ui/Toast";
import { formatBanglaDate } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import type { ReportReason, ReportStatus, ReportTargetType } from "@/types";
import { useAdminReports, useModerationMutations, type AdminReportRow } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

const TARGET_KEY = {
  REVIEW: "targetREVIEW",
  SHOP: "targetSHOP",
  MESSAGE: "targetMESSAGE",
  USER: "targetUSER",
} as const satisfies Record<ReportTargetType, keyof typeof adminDict>;

const REASON_KEY = {
  SPAM: "reasonSPAM",
  ABUSE: "reasonABUSE",
  FAKE: "reasonFAKE",
  INAPPROPRIATE: "reasonINAPPROPRIATE",
  OTHER: "reasonOTHER",
} as const satisfies Record<ReportReason, keyof typeof adminDict>;

export function ModerationView() {
  const t = useT(adminDict);
  const [status, setStatus] = useState<ReportStatus>("OPEN");
  const { data, isPending } = useAdminReports(status);
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title={t("moderationTitle")} description={t("moderationSubtitle")} />

      <TabBar
        tabs={[
          { id: "OPEN", label: t("tabOpen") },
          { id: "RESOLVED", label: t("tabResolved") },
          { id: "DISMISSED", label: t("tabDismissed") },
        ]}
        active={status}
        onChange={(id) => setStatus(id as ReportStatus)}
      />

      {isPending ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="h-6 w-6 text-muted" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Flag className="h-6 w-6" />}
          title={t("moderationEmptyTitle")}
          description={t("moderationEmptyDesc")}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((report) => (
            <li key={report.id}>
              <ReportCard report={report} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportCard({ report }: { report: AdminReportRow }) {
  const t = useT(adminDict);
  const showToast = useToast();
  const { resolve, hideReview } = useModerationMutations();

  const isReview = report.target_type === "REVIEW";
  const hidden = report.target_hidden === true;

  const act = (status: ReportStatus) =>
    resolve.mutate(
      { reportId: report.id, status },
      {
        onSuccess: () => showToast(t("reportResolved")),
        onError: () => showToast(t("reportFailed")),
      },
    );

  const toggleHidden = () =>
    hideReview.mutate(
      { reviewId: report.target_id, hidden: !hidden, reason: report.reason },
      {
        onSuccess: () => showToast(hidden ? t("reviewUnhidden") : t("reviewHidden")),
        onError: () => showToast(t("hideFailed")),
      },
    );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="accent">{t(TARGET_KEY[report.target_type])}</Badge>
          <Badge variant="live">{t(REASON_KEY[report.reason])}</Badge>
          {hidden && <Badge variant="neutral">{t("hiddenBadge")}</Badge>}
          {report.status !== "OPEN" && <Badge variant="neutral">{report.status}</Badge>}
        </div>
        <span className="text-[11px] whitespace-nowrap text-muted">
          {formatBanglaDate(new Date(report.created_at))}
        </span>
      </div>

      {/* What was actually reported — inlined so triage doesn't need a click. */}
      <div className="rounded-xl bg-soft px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-ink">
            {report.target_title || "—"}
          </p>
          {isReview && report.target_rating !== null && (
            <span className="inline-flex shrink-0 items-center gap-1 font-number text-xs font-semibold text-brass">
              <Star className="h-3.5 w-3.5 fill-brass" />
              {report.target_rating}
            </span>
          )}
        </div>
        {report.target_body && <p className="mt-1 text-sm text-muted">{report.target_body}</p>}
        {report.shop_name && <p className="mt-1 text-[11px] text-muted/80">{report.shop_name}</p>}
      </div>

      <div className="text-xs text-muted">
        <p>{t("reportedBy", report.reporter_name ?? "—")}</p>
        {report.note && <p className="mt-0.5 text-ink">{report.note}</p>}
        {report.resolution_note && (
          <p className="mt-0.5 italic">{report.resolution_note}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {isReview && (
          <Button
            size="sm"
            variant={hidden ? "outline" : "danger"}
            loading={hideReview.isPending}
            onClick={toggleHidden}
          >
            {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {hidden ? t("unhideReview") : t("hideReview")}
          </Button>
        )}

        {report.target_owner_id && (
          <Link
            href={`/admin/users/${report.target_owner_id}`}
            className="inline-flex min-h-8 items-center rounded-full border border-line px-3 text-xs font-semibold text-muted hover:bg-soft"
          >
            {t("viewReportedUser")}
          </Link>
        )}
        {report.shop_id && (
          <Link
            href={`/admin/shops/${report.shop_id}`}
            className="inline-flex min-h-8 items-center rounded-full border border-line px-3 text-xs font-semibold text-muted hover:bg-soft"
          >
            {t("viewReportedShop")}
          </Link>
        )}

        {report.status === "OPEN" ? (
          <>
            <Button size="sm" loading={resolve.isPending} onClick={() => act("RESOLVED")}>
              <Check className="h-4 w-4" />
              {t("markResolved")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={resolve.isPending}
              onClick={() => act("DISMISSED")}
            >
              <X className="h-4 w-4" />
              {t("dismissReport")}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            loading={resolve.isPending}
            onClick={() => act("OPEN")}
          >
            {t("reopenReport")}
          </Button>
        )}
      </div>
    </Card>
  );
}
