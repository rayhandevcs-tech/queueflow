"use client";

import Link from "next/link";
import { ChevronRight, Heart, ShieldAlert, ShieldCheck, Settings, Sparkles, Store } from "lucide-react";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { formatMoney } from "@/lib/format-wait";
import { Spinner } from "@/components/ui/Spinner";
import { ProfileHeaderCard } from "@/components/ui/ProfileHeaderCard";
import { useT } from "@/lib/i18n";
import { useProfileHistory } from "../hooks/use-profile-history";
import { useMyFavoriteShops } from "../hooks/use-favorites";
import { HabitsCard } from "./HabitsCard";
import { FavoriteAlertsCard } from "./FavoriteAlertsCard";
import { customerProfileDict } from "../lib/i18n";

export function ProfileView({
  fullName,
  phone,
  avatarUrl,
}: {
  fullName: string;
  phone: string | null;
  avatarUrl?: string | null;
}) {
  const { history, shopsById, trust, spending, isPending } = useProfileHistory();
  const { shops: favoriteShops } = useMyFavoriteShops();
  const t = useT(customerProfileDict);
  const businessTypeT = useT(BUSINESS_TYPE_LABEL);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  const maxMonthlySpend = Math.max(1, ...spending.monthlyTrend.map((m) => m.amount));
  const maxShopSpend = Math.max(1, ...spending.byShop.map((s) => s.amount));

  let callout: { icon: React.ReactNode; bg: string; border: string; text: React.ReactNode };
  if (trust.score === null) {
    callout = {
      icon: <Sparkles className="h-5.5 w-5.5 text-accent" />,
      bg: "var(--color-soft)",
      border: "var(--color-line)",
      text: t("newCustomerCallout"),
    };
  } else if (trust.score >= 4) {
    callout = {
      icon: <ShieldCheck className="h-5.5 w-5.5 text-good" />,
      bg: "var(--color-good-soft)",
      border: "color-mix(in srgb, var(--color-good) 25%, transparent)",
      text: t("trustedCustomerCallout"),
    };
  } else {
    callout = {
      icon: <ShieldAlert className="h-5.5 w-5.5 text-live" />,
      bg: "var(--color-live-soft)",
      border: "color-mix(in srgb, var(--color-live) 25%, transparent)",
      text: t("someAbsencesCallout"),
    };
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-ink">{t("myProfileTitle")}</h1>
        <Link
          href="/account"
          className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-soft"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      <ProfileHeaderCard
        name={fullName || t("customerFallback")}
        subtitle={phone || "—"}
        avatarUrl={avatarUrl}
        right={
          <div className="rounded-[14px] bg-white px-3 py-2 text-center shadow-xs">
            <p className="font-number text-xl font-bold text-good">{trust.score ?? "—"}</p>
            <p className="text-[10px] text-muted">{t("trustScoreLabel")}</p>
          </div>
        }
      />

      <div
        className="mt-3.25 flex items-center gap-2.75 rounded-2xl p-3.5"
        style={{ background: callout.bg, border: `1px solid ${callout.border}` }}
      >
        {callout.icon}
        <p className="text-xs leading-relaxed text-ink">{callout.text}</p>
      </div>

      <div className="mt-3.25 flex gap-2.25">
        <div className="flex-1 rounded-[14px] border border-line bg-soft p-3.25 text-center">
          <p className="font-number text-xl font-bold text-ink">{trust.visitCount}</p>
          <p className="text-[11px] text-muted">{t("totalVisits")}</p>
        </div>
        <div className="flex-1 rounded-[14px] border border-line bg-soft p-3.25 text-center">
          <p className="font-number text-xl font-bold text-ink">{trust.noShowCount}</p>
          <p className="text-[11px] text-muted">{t("noShows")}</p>
        </div>
        <div className="flex-1 rounded-[14px] border border-line bg-soft p-3.25 text-center">
          <p className="font-number text-xl font-bold text-ink">{trust.regularShopCount}</p>
          <p className="text-[11px] text-muted">{t("regularShops")}</p>
        </div>
      </div>

      <div className="mt-5 mb-2.75 flex items-center justify-between">
        <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">{t("spendingHeading")}</p>
        <Link
          href="/transactions"
          className="flex items-center gap-0.5 text-[12px] font-semibold text-accent"
        >
          {t("seeAllTransactions")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex gap-2.25">
        <div className="flex-1 rounded-[18px] bg-accent p-4 text-accent-ink">
          <p className="text-xs opacity-60">{t("spentThisMonth")}</p>
          <p className="mt-1 font-number text-2xl font-bold">
            ৳{formatMoney(spending.month.amount)}
          </p>
          <p className="mt-1 text-[11px] opacity-50">
            {spending.month.changePct === null
              ? t("noSpendLastMonth")
              : spending.month.changePct >= 0
                ? t("moreThanLastMonth", spending.month.changePct)
                : t("lessThanLastMonth", Math.abs(spending.month.changePct))}
          </p>
        </div>
        <div className="flex-1 rounded-[18px] border border-line bg-card p-4">
          <p className="text-xs text-muted">{t("totalSpend")}</p>
          <p className="mt-1 font-number text-2xl font-bold text-ink">
            ৳{formatMoney(spending.total.amount)}
          </p>
          <p className="mt-1 text-[11px] text-muted">{t("visitsCountSuffix", trust.visitCount)}</p>
        </div>
      </div>

      <div className="mt-2.25 rounded-[18px] border border-line bg-card p-4">
        <div className="mb-3.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">{t("last12MonthsSpend")}</p>
          <p className="text-[11px] text-muted">{t("inThousands")}</p>
        </div>
        <div className="flex h-32 items-end gap-1.75">
          {spending.monthlyTrend.map((m, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.25">
              <div
                className="w-full max-w-6 rounded-t-[5px]"
                style={{
                  height: `${Math.max(2, (m.amount / maxMonthlySpend) * 100)}%`,
                  background: m.isCurrent ? "var(--color-accent)" : "var(--color-brass-soft)",
                }}
                title={`৳${formatMoney(m.amount)}`}
              />
              <span
                className={m.isCurrent ? "text-[9px] font-semibold text-ink" : "text-[9px] text-muted"}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {spending.byShop.length > 0 && (
        <div className="mt-2.25 rounded-[18px] border border-line bg-card p-4">
          <p className="mb-3 text-[13px] font-semibold text-ink">{t("spendByShop")}</p>
          <div className="flex flex-col gap-2.75">
            {spending.byShop.map((s) => {
              const shop = shopsById[s.shopId];
              return (
                <div key={s.shopId} className="flex items-center gap-2.5">
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg text-[11px] font-bold text-white"
                    style={
                      shop?.logo_url || shop?.cover_image_url
                        ? undefined
                        : { background: shop ? shopAvatarColor(shop.id) : "var(--color-muted)" }
                    }
                  >
                    {shop?.logo_url || shop?.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={shop.logo_url ?? shop.cover_image_url ?? undefined}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : shop ? (
                      shopInitial(shop.name)
                    ) : (
                      <Store className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[13px] text-ink">
                      <span className="truncate">{shop?.name ?? t("shopFallback")}</span>
                      <b className="font-number shrink-0">৳{formatMoney(s.amount)}</b>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="h-1.5 w-full max-w-[70%] rounded-md bg-soft">
                        <div
                          className="h-full rounded-md bg-accent"
                          style={{ width: `${Math.max(2, (s.amount / maxShopSpend) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted">{t("visitsSuffixShort", s.visitCount)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Their own rhythm, and the offer to be reminded of it — placed above
          favourites because it's the thing that brings them back. */}
      <div className="mt-5">
        <HabitsCard serials={history} shopsById={shopsById} />
      </div>

      <div className="mt-5 mb-2.75 flex items-center justify-between">
        <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">{t("favoriteShopsHeading")}</p>
        {favoriteShops.length > 0 && (
          <Link
            href="/my-serial"
            className="flex items-center gap-0.5 text-[12px] font-semibold text-accent"
          >
            {t("seeAllBookings")}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {favoriteShops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          <Heart className="mx-auto mb-2 h-5 w-5 text-muted" />
          {t("noFavoritesYet")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {favoriteShops.map((shop) => (
            <Link
              key={shop.id}
              href={`/explore/${shop.id}`}
              className="flex items-center gap-2.5 rounded-2xl border border-line bg-card p-2.5 shadow-xs transition-transform hover:-translate-y-0.5"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white">
                {shop.logo_url || shop.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shop.logo_url ?? shop.cover_image_url ?? undefined}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="grid h-full w-full place-items-center"
                    style={{ background: shopAvatarColor(shop.id) }}
                  >
                    {shopInitial(shop.name)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{shop.name}</p>
                <p className="truncate text-[11px] text-muted">{businessTypeT(shop.business_type)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <FavoriteAlertsCard shopsById={shopsById} />
    </div>
  );
}
