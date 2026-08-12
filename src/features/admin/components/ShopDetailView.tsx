"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Armchair,
  Ban,
  Check,
  Image as ImageIcon,
  MapPin,
  Percent,
  Phone,
  Radio,
  Receipt,
  Scissors,
  Star,
  Store,
  TriangleAlert,
  UserX,
  Wallet,
  X,
} from "lucide-react";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { describeDbError } from "@/lib/supabase/db-errors";
import { Spinner } from "@/components/ui/Spinner";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT, useLanguage } from "@/lib/i18n";
import { useAdminShop, type AdminShopDetail } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";
import { ShopStatusActions } from "./ShopStatusActions";
import { ShopStatusBadge } from "./ShopStatusBadge";

export function ShopDetailView({ shopId }: { shopId: string }) {
  const { data, isPending, error } = useAdminShop(shopId);
  const t = useT(adminDict);
  const { language } = useLanguage();

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  // A failed request and a shop that does not exist are different problems,
  // and this screen used to report both as "shop not found" — which is how a
  // 400 from the RPC spent a whole afternoon looking like a routing bug. The
  // server's own message is the fastest thing to act on, so it is shown.
  if (error) {
    return (
      <EmptyState
        icon={<TriangleAlert className="h-6 w-6" />}
        title={t("shopDetailLoadFailed")}
        description={describeDbError(error)}
        action={
          <Link href="/admin/shops" className="text-sm font-semibold text-accent hover:underline">
            {t("backToShops")}
          </Link>
        }
      />
    );
  }

  if (!data?.shop) {
    return (
      <EmptyState
        icon={<Store className="h-6 w-6" />}
        title={t("shopDetailNotFound")}
        action={
          <Link href="/admin/shops" className="text-sm font-semibold text-accent hover:underline">
            {t("backToShops")}
          </Link>
        }
      />
    );
  }

  const { shop, owner, owner_email, stats, readiness, recent_reviews, audit } = data;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/shops"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToShops")}
      </Link>

      {/* Identity + actions */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <AvatarChip label={shop.name} avatarUrl={shop.logo_url} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold text-ink">{shop.name}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {BUSINESS_TYPE_LABEL[shop.business_type][language]}
              {shop.address ? ` · ${shop.address}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ShopStatusBadge status={shop.status} />
              {shop.is_featured && <Badge variant="brass">{t("featured")}</Badge>}
              {shop.status === "ACTIVE" && (
                <Badge variant={shop.is_open ? "good" : "neutral"}>
                  {shop.is_open ? t("openNow") : t("closedNow")}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {shop.status_reason && (
          <p className="rounded-xl bg-soft px-3 py-2 text-sm text-muted">{shop.status_reason}</p>
        )}

        <div className="border-t border-line pt-3.5">
          <p className="mb-2 text-xs font-bold text-muted uppercase">{t("actionsTitle")}</p>
          <ShopStatusActions
            shopId={shop.id}
            status={shop.status}
            isFeatured={shop.is_featured}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReadinessCard readiness={readiness} status={shop.status} />
        <OwnerCard owner={owner} email={owner_email} />
      </div>

      <StatsCard stats={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewsCard reviews={recent_reviews} />
        <AuditCard audit={audit} />
      </div>
    </div>
  );
}

function ReadinessCard({
  readiness,
  status,
}: {
  readiness: AdminShopDetail["readiness"];
  status: AdminShopDetail["shop"]["status"];
}) {
  const t = useT(adminDict);

  const items = [
    { ok: readiness.has_chair, label: t("readyChair"), critical: true },
    { ok: readiness.has_service, label: t("readyService"), critical: true },
    { ok: readiness.has_location, label: t("readyLocation"), critical: true },
    { ok: readiness.has_phone, label: t("readyPhone"), critical: false },
    { ok: readiness.has_cover, label: t("readyCover"), critical: false },
    { ok: readiness.has_about, label: t("readyAbout"), critical: false },
    { ok: readiness.has_hours, label: t("readyHours"), critical: false },
  ];
  const missingCritical = items.some((i) => i.critical && !i.ok);

  return (
    <Card className="p-4">
      <h2 className="text-sm font-bold text-ink">{t("readinessTitle")}</h2>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                item.ok ? "bg-good-soft text-good" : "bg-soft text-muted",
              )}
            >
              {item.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            <span className={item.ok ? "text-ink" : "text-muted"}>{item.label}</span>
          </li>
        ))}
      </ul>
      {missingCritical && status === "PENDING" && (
        <p className="mt-3 rounded-xl bg-live-soft px-3 py-2 text-xs text-live">
          {t("readinessIncompleteHint")}
        </p>
      )}
    </Card>
  );
}

function OwnerCard({
  owner,
  email,
}: {
  owner: AdminShopDetail["owner"];
  email: string | null;
}) {
  const t = useT(adminDict);

  return (
    <Card className="p-4">
      <h2 className="text-sm font-bold text-ink">{t("ownerSectionTitle")}</h2>
      {owner ? (
        <div className="mt-3 flex items-start gap-3">
          <AvatarChip label={owner.full_name} avatarUrl={owner.avatar_url} shape="circle" size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{owner.full_name}</p>
            {email && <p className="truncate text-xs text-muted">{email}</p>}
            <p className="mt-0.5 text-xs text-muted">
              {t("ownerJoined", formatBanglaDate(new Date(owner.created_at)))}
            </p>
            {owner.phone ? (
              <a
                href={`tel:${owner.phone}`}
                className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent px-3 text-xs font-semibold text-accent hover:bg-accent/10"
              >
                <Phone className="h-3.5 w-3.5" />
                {owner.phone}
              </a>
            ) : (
              <p className="mt-2 text-xs text-muted">{t("noPhone")}</p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">—</p>
      )}
    </Card>
  );
}

function StatsCard({ stats }: { stats: AdminShopDetail["stats"] }) {
  const t = useT(adminDict);

  const items = [
    { icon: <Armchair className="h-4 w-4" />, label: t("statChairs"), value: toBanglaDigits(stats.chairs) },
    { icon: <Scissors className="h-4 w-4" />, label: t("statServices"), value: toBanglaDigits(stats.services) },
    { icon: <ImageIcon className="h-4 w-4" />, label: t("statGallery"), value: toBanglaDigits(stats.gallery) },
    { icon: <Percent className="h-4 w-4" />, label: t("statOffersActive"), value: toBanglaDigits(stats.offers_active) },
    { icon: <Radio className="h-4 w-4" />, label: t("statSerialsLiveShop"), value: toBanglaDigits(stats.serials_live) },
    { icon: <Receipt className="h-4 w-4" />, label: t("statSerials30dShop"), value: toBanglaDigits(stats.serials_30d) },
    { icon: <Receipt className="h-4 w-4" />, label: t("statSerialsTotal"), value: toBanglaDigits(stats.serials_total) },
    { icon: <UserX className="h-4 w-4" />, label: t("statNoShows"), value: toBanglaDigits(stats.no_shows_30d) },
    { icon: <Wallet className="h-4 w-4" />, label: t("statRevenue30d"), value: `৳${formatMoney(Math.round(stats.revenue_30d))}` },
    { icon: <Ban className="h-4 w-4" />, label: t("statDueTotal"), value: `৳${formatMoney(Math.round(stats.due_total))}` },
    {
      icon: <Star className="h-4 w-4" />,
      label: t("statRating"),
      value: stats.review_count === 0 ? "—" : `${stats.avg_rating.toFixed(1)} (${toBanglaDigits(stats.review_count)})`,
    },
    {
      icon: <MapPin className="h-4 w-4" />,
      label: t("statLastSerial"),
      value: stats.last_serial_at ? formatBanglaDate(new Date(stats.last_serial_at)) : "—",
    },
  ];

  return (
    <Card className="p-4">
      <h2 className="text-sm font-bold text-ink">{t("statsSectionTitle")}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-soft text-muted">
              {item.icon}
            </span>
            <div className="min-w-0">
              <dd className="truncate font-number text-sm font-bold text-ink">{item.value}</dd>
              <dt className="truncate text-[11px] text-muted">{item.label}</dt>
            </div>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function ReviewsCard({ reviews }: { reviews: AdminShopDetail["recent_reviews"] }) {
  const t = useT(adminDict);

  return (
    <Card className="p-4">
      <h2 className="text-sm font-bold text-ink">{t("reviewsSectionTitle")}</h2>
      {reviews.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t("noReviewsYet")}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="border-b border-line/70 pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {review.customer_name ?? "—"}
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 font-number text-xs font-semibold text-brass">
                  <Star className="h-3.5 w-3.5 fill-brass" />
                  {review.rating}
                </span>
              </div>
              {review.comment && <p className="mt-1 text-sm text-muted">{review.comment}</p>}
              <p className="mt-1 text-[11px] text-muted/80">
                {formatBanglaDate(new Date(review.created_at))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AuditCard({ audit }: { audit: AdminShopDetail["audit"] }) {
  const t = useT(adminDict);

  return (
    <Card className="p-4">
      <h2 className="text-sm font-bold text-ink">{t("auditSectionTitle")}</h2>
      {audit.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t("noAuditYet")}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {audit.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="text-ink">
                {entry.action === "SHOP_STATUS"
                  ? t("auditStatusChange", entry.meta.from ?? "—", entry.meta.to ?? "—")
                  : entry.meta.featured
                    ? t("auditFeatured")
                    : t("auditUnfeatured")}
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
  );
}
