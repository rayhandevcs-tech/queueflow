"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  EyeOff,
  Flag,
  MessageSquareWarning,
  Moon,
  Radio,
  ShieldOff,
  Star,
  Store,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useAdminOverview } from "../hooks/use-admin";
import { adminDict } from "../lib/i18n";
import { StatCard } from "./StatCard";
import { TrendChart } from "./TrendChart";

export function OverviewView() {
  const { data, isPending, isError, refetch } = useAdminOverview();
  const t = useT(adminDict);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<MessageSquareWarning className="h-6 w-6" />}
        title={t("loadFailed")}
        action={
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-sm font-semibold text-accent hover:underline"
          >
            {t("retry")}
          </button>
        }
      />
    );
  }

  const n = (value: number) => toBanglaDigits(value);

  return (
    <div className="space-y-6">
      <PageHeader title={t("overviewTitle")} description={t("overviewSubtitle")} />

      {/* Work queue first: the panel exists to get these two numbers to zero. */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-bold text-ink">{t("needsAttention")}</h2>
        {data.shops_pending === 0 && data.open_reports === 0 && data.dormant_shops === 0 ? (
          <EmptyState
            dashed
            icon={<BadgeCheck className="h-6 w-6" />}
            title={t("allClearTitle")}
            description={t("allClearDesc")}
          />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {data.shops_pending > 0 && (
              <Link href="/admin/verification" className="block">
                <Card
                  hover
                  className="flex items-center gap-3 border-brass/40 bg-brass-soft/40 p-4"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brass-soft text-brass">
                    <CalendarClock className="h-4.5 w-4.5" />
                  </span>
                  <p className="text-sm font-semibold text-ink">
                    {t("pendingShopsCta", data.shops_pending)}
                  </p>
                </Card>
              </Link>
            )}
            {data.open_reports > 0 && (
              <Link href="/admin/moderation" className="block">
                <Card hover className="flex items-center gap-3 border-live/30 bg-live-soft/50 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-live-soft text-live">
                    <Flag className="h-4.5 w-4.5" />
                  </span>
                  <p className="text-sm font-semibold text-ink">
                    {t("openReportsCta", data.open_reports)}
                  </p>
                </Card>
              </Link>
            )}
            {data.dormant_shops > 0 && (
              <Link href="/admin/shops?status=ACTIVE" className="block">
                <Card hover className="flex items-center gap-3 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-soft text-muted">
                    <Moon className="h-4.5 w-4.5" />
                  </span>
                  <p className="text-sm font-semibold text-ink">
                    {t("dormantShopsCta", data.dormant_shops)}
                  </p>
                </Card>
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-bold text-ink">{t("sectionShops")}</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Store className="h-4.5 w-4.5" />}
            tone="good"
            label={t("statShopsActive")}
            value={n(data.shops_active)}
            hint={`${t("salonCount", data.shops_salon)} · ${t("parlourCount", data.shops_parlour)}`}
            href="/admin/shops?status=ACTIVE"
          />
          <StatCard
            icon={<CalendarClock className="h-4.5 w-4.5" />}
            tone="accent"
            label={t("statShopsPending")}
            value={n(data.shops_pending)}
            href="/admin/verification"
          />
          <StatCard
            icon={<Radio className="h-4.5 w-4.5" />}
            label={t("statShopsOpenNow")}
            value={n(data.shops_open_now)}
          />
          <StatCard
            icon={<MessageSquareWarning className="h-4.5 w-4.5" />}
            tone="live"
            label={t("statShopsSuspended")}
            value={n(data.shops_suspended)}
            href="/admin/shops?status=SUSPENDED"
          />
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-bold text-ink">{t("sectionUsers")}</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Users className="h-4.5 w-4.5" />}
            label={t("statCustomers")}
            value={n(data.customers_total)}
          />
          <StatCard
            icon={<Store className="h-4.5 w-4.5" />}
            label={t("statProviders")}
            value={n(data.providers_total)}
          />
          <StatCard
            icon={<UserPlus className="h-4.5 w-4.5" />}
            tone="accent"
            label={t("statSignups7d")}
            value={n(data.signups_7d)}
          />
          <StatCard
            icon={<Star className="h-4.5 w-4.5" />}
            label={t("statReviews")}
            value={n(data.reviews_total)}
          />
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Flag className="h-4.5 w-4.5" />}
            tone="live"
            label={t("statOpenReports")}
            value={n(data.open_reports)}
            href="/admin/moderation"
          />
          <StatCard
            icon={<ShieldOff className="h-4.5 w-4.5" />}
            label={t("statBlockedUsers")}
            value={n(data.blocked_users)}
            href="/admin/users"
          />
          <StatCard
            icon={<EyeOff className="h-4.5 w-4.5" />}
            label={t("statHiddenReviews")}
            value={n(data.hidden_reviews)}
          />
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-bold text-ink">{t("sectionActivity")}</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Radio className="h-4.5 w-4.5" />}
            tone="live"
            label={t("statSerialsLive")}
            value={n(data.serials_live)}
          />
          <StatCard
            icon={<CalendarClock className="h-4.5 w-4.5" />}
            label={t("statSerialsToday")}
            value={n(data.serials_today)}
          />
          <StatCard
            icon={<CalendarClock className="h-4.5 w-4.5" />}
            label={t("statSerials30d")}
            value={n(data.serials_30d)}
          />
          <StatCard
            icon={<Wallet className="h-4.5 w-4.5" />}
            tone="good"
            label={t("statGmv30d")}
            value={`৳${formatMoney(Math.round(data.gmv_30d))}`}
          />
        </div>
      </section>

      <TrendChart daily={data.daily} />
    </div>
  );
}
