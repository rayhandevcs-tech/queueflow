"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Heart,
  Phone,
  Receipt,
  ShieldCheck,
  Star,
  Store,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Badge } from "@/components/ui/Badge";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useAdminUser, useAdminUserMutations } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";

export function UserDetailView({ userId }: { userId: string }) {
  const { data, isPending } = useAdminUser(userId);
  const t = useT(adminDict);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title={t("userNotFound")}
        action={
          <Link href="/admin/users" className="text-sm font-semibold text-accent hover:underline">
            {t("backToUsers")}
          </Link>
        }
      />
    );
  }

  const { profile, email, last_sign_in_at, shop, stats, recent_serials, reports_against, audit } =
    data;
  const blocked = !!profile.blocked_at;
  // A handful of no-shows out of a handful of bookings is the pattern worth
  // flagging — not a single miss on a long history.
  const noShowRate = stats.serials_total > 0 ? stats.no_shows / stats.serials_total : 0;
  const noShowConcern = stats.no_shows >= 3 && noShowRate >= 0.25;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToUsers")}
      </Link>

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <AvatarChip
            label={profile.full_name}
            avatarUrl={profile.avatar_url}
            shape="circle"
            size={56}
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold text-ink">{profile.full_name}</h1>
            <p className="mt-0.5 truncate text-sm text-muted">{email ?? ""}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={profile.role === "provider" ? "accent" : "neutral"}>
                {profile.role === "provider" ? t("roleProvider") : t("roleCustomer")}
              </Badge>
              {blocked && <Badge variant="live">{t("blockedBadge")}</Badge>}
              {shop && (
                <Badge variant="neutral">
                  <Store className="h-3 w-3" />
                  {t("ownsShop")}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              {t("ownerJoined", formatBanglaDate(new Date(profile.created_at)))} ·{" "}
              {last_sign_in_at
                ? t("lastSignIn", formatBanglaDate(new Date(last_sign_in_at)))
                : t("neverSignedIn")}
            </p>
            {profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent px-3 text-xs font-semibold text-accent hover:bg-accent/10"
              >
                <Phone className="h-3.5 w-3.5" />
                {profile.phone}
              </a>
            )}
          </div>
        </div>

        {blocked && profile.blocked_reason && (
          <p className="rounded-xl bg-live-soft px-3 py-2 text-sm text-live">
            {profile.blocked_reason}
          </p>
        )}

        <div className="border-t border-line pt-3.5">
          <p className="mb-2 text-xs font-bold text-muted uppercase">{t("actionsTitle")}</p>
          <BlockAction userId={profile.id} blocked={blocked} />
        </div>
      </Card>

      {shop && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted uppercase">{t("ownedShopTitle")}</p>
            <p className="mt-1 truncate font-semibold text-ink">{shop.name}</p>
          </div>
          <Link
            href={`/admin/shops/${shop.id}`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            {t("viewShop")}
          </Link>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="text-sm font-bold text-ink">{t("statsSectionTitle")}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <Stat icon={<Receipt className="h-4 w-4" />} label={t("statSerialsTotalUser")} value={toBanglaDigits(stats.serials_total)} />
          <Stat icon={<Receipt className="h-4 w-4" />} label={t("statSerialsDone")} value={toBanglaDigits(stats.serials_done)} />
          <Stat icon={<Ban className="h-4 w-4" />} label={t("statCancelled")} value={toBanglaDigits(stats.cancelled)} />
          <Stat
            icon={<UserX className="h-4 w-4" />}
            label={t("statNoShowsUser")}
            value={toBanglaDigits(stats.no_shows)}
            alert={noShowConcern}
          />
          <Stat icon={<Wallet className="h-4 w-4" />} label={t("statSpend")} value={`৳${formatMoney(Math.round(stats.spend_total))}`} />
          <Stat icon={<Wallet className="h-4 w-4" />} label={t("statDue")} value={`৳${formatMoney(Math.round(stats.due_total))}`} alert={stats.due_total > 0} />
          <Stat icon={<Star className="h-4 w-4" />} label={t("statReviewsWritten")} value={toBanglaDigits(stats.reviews_count)} />
          <Stat icon={<Heart className="h-4 w-4" />} label={t("statFavourites")} value={toBanglaDigits(stats.favourites)} />
        </dl>
        {noShowConcern && (
          <p className="mt-3 rounded-xl bg-live-soft px-3 py-2 text-xs text-live">
            {t("noShowWarning")}
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-bold text-ink">{t("recentSerialsTitle")}</h2>
          {recent_serials.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t("noSerialsYet")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recent_serials.map((serial) => (
                <li
                  key={serial.id}
                  className="flex items-center justify-between gap-2 border-b border-line/70 pb-2 text-sm last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ink">{serial.shop_name ?? "—"}</p>
                    <p className="text-[11px] text-muted">
                      {formatBanglaDate(new Date(serial.created_at))} · {serial.status}
                    </p>
                  </div>
                  <span className="shrink-0 font-number text-sm font-semibold text-ink">
                    ৳{formatMoney(Math.round(serial.total_amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-bold text-ink">{t("reportsAgainstTitle")}</h2>
          {reports_against.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t("noReportsAgainst")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reports_against.map((report) => (
                <li key={report.id} className="border-b border-line/70 pb-2 text-sm last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={report.status === "OPEN" ? "live" : "neutral"}>
                      {report.status}
                    </Badge>
                    <span className="truncate text-ink">{report.reason}</span>
                  </div>
                  {report.note && <p className="mt-0.5 text-xs text-muted">{report.note}</p>}
                  <p className="text-[11px] text-muted/80">
                    {formatBanglaDate(new Date(report.created_at))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-bold text-ink">{t("auditSectionTitle")}</h2>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("noAuditYet")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {audit.map((entry) => (
              <li key={entry.id} className="text-sm">
                <p className="inline-flex items-center gap-1.5 text-ink">
                  {entry.action === "USER_BLOCKED" ? (
                    <Ban className="h-3.5 w-3.5 text-live" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-good" />
                  )}
                  {entry.action === "USER_BLOCKED" ? t("blockUser") : t("unblockUser")}
                </p>
                {entry.meta.reason && <p className="text-xs text-muted">{entry.meta.reason}</p>}
                <p className="text-[11px] text-muted/80">
                  {formatBanglaDate(new Date(entry.created_at))}{" "}
                  {t("byActor", entry.actor_name ?? t("systemActor"))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
          alert ? "bg-live-soft text-live" : "bg-soft text-muted",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <dd className={cn("truncate font-number text-sm font-bold", alert ? "text-live" : "text-ink")}>
          {value}
        </dd>
        <dt className="truncate text-[11px] text-muted">{label}</dt>
      </div>
    </div>
  );
}

function BlockAction({ userId, blocked }: { userId: string; blocked: boolean }) {
  const t = useT(adminDict);
  const showToast = useToast();
  const { changeBlocked } = useAdminUserMutations(userId);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setReason("");
    setError(null);
  };

  const confirm = () => {
    if (!blocked && !reason.trim()) {
      setError(t("reasonRequired"));
      return;
    }
    changeBlocked.mutate(
      { blocked: !blocked, reason: blocked ? null : reason },
      {
        onSuccess: () => {
          showToast(t("blockUpdated"));
          close();
        },
        onError: (err) => {
          const message = (err as { message?: string } | null)?.message ?? "";
          showToast(
            message.includes("cannot block") ? t("cannotBlockAdmin") : t("blockFailed"),
          );
        },
      },
    );
  };

  return (
    <>
      <Button variant={blocked ? "outline" : "danger"} onClick={() => setOpen(true)}>
        {blocked ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
        {blocked ? t("unblockUser") : t("blockUser")}
      </Button>

      <BottomSheet
        open={open}
        onClose={close}
        title={blocked ? t("unblockConfirmTitle") : t("blockConfirmTitle")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {blocked ? t("unblockConfirmDesc") : t("blockConfirmDesc")}
          </p>

          {!blocked && (
            <Field label={t("reasonLabel")} error={error ?? undefined}>
              <Input
                autoFocus
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                placeholder={t("reasonPlaceholder")}
                invalid={!!error}
              />
            </Field>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close} disabled={changeBlocked.isPending}>
              {t("cancelLabel")}
            </Button>
            <Button
              variant={blocked ? "primary" : "danger"}
              loading={changeBlocked.isPending}
              onClick={confirm}
            >
              {t("confirmLabel")}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
