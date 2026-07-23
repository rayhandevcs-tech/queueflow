"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, ShieldAlert, ShieldCheck, Sparkles, Star, Store } from "lucide-react";
import type { Serial } from "@/types";
import { parseServicesSnapshot } from "@/types";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { formatBanglaDate, formatMoney } from "@/lib/format-wait";
import { Spinner } from "@/components/ui/Spinner";
import { useProfileHistory } from "../hooks/use-profile-history";
import { ReviewDialog } from "./ReviewDialog";

export function ProfileView({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string | null;
}) {
  const { history, shopsById, ratingsBySerial, trust, spending, isPending } = useProfileHistory();
  const [reviewing, setReviewing] = useState<Serial | null>(null);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  const doneHistory = history.filter((s) => s.status === "DONE");
  const maxMonthlySpend = Math.max(1, ...spending.monthlyTrend.map((m) => m.amount));
  const maxShopSpend = Math.max(1, ...spending.byShop.map((s) => s.amount));

  let callout: { icon: React.ReactNode; bg: string; border: string; text: React.ReactNode };
  if (trust.score === null) {
    callout = {
      icon: <Sparkles className="h-5.5 w-5.5 text-accent" />,
      bg: "var(--color-soft)",
      border: "var(--color-line)",
      text: (
        <>
          <b>নতুন কাস্টমার।</b> সিরিয়াল দিয়ে সার্ভিস নিতে থাকলে তোমার ট্রাস্ট স্কোর তৈরি হবে।
        </>
      ),
    };
  } else if (trust.score >= 4) {
    callout = {
      icon: <ShieldCheck className="h-5.5 w-5.5 text-good" />,
      bg: "var(--color-good-soft)",
      border: "color-mix(in srgb, var(--color-good) 25%, transparent)",
      text: (
        <>
          <b>বিশ্বস্ত কাস্টমার।</b> তুমি সিরিয়াল দিয়ে সার্ভিস নাও — তাই দোকানদাররা তোমার সিরিয়াল
          অগ্রাধিকার দেয়।
        </>
      ),
    };
  } else {
    callout = {
      icon: <ShieldAlert className="h-5.5 w-5.5 text-live" />,
      bg: "var(--color-live-soft)",
      border: "color-mix(in srgb, var(--color-live) 25%, transparent)",
      text: (
        <>
          <b>কিছু সিরিয়ালে অনুপস্থিত ছিলে।</b> নিয়মিত সিরিয়াল রাখলে ট্রাস্ট স্কোর আবার বাড়বে।
        </>
      ),
    };
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-ink">আমার প্রোফাইল</h1>
        <Link
          href="/account"
          className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-soft"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      <div className="flex items-center gap-3.75 rounded-[22px] bg-ink p-5 text-paper">
        <div className="grid h-15 w-15 shrink-0 place-items-center rounded-[18px] bg-accent font-display text-2xl font-extrabold text-accent-ink">
          {fullName.trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{fullName || "কাস্টমার"}</p>
          <p className="text-xs text-paper/55">{phone || "—"}</p>
        </div>
        <div className="shrink-0 rounded-[14px] bg-white/10 px-3 py-2 text-center">
          <p className="font-number text-xl font-bold text-good">{trust.score ?? "—"}</p>
          <p className="text-[10px] text-paper/60">ট্রাস্ট স্কোর</p>
        </div>
      </div>

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
          <p className="text-[11px] text-muted">মোট ভিজিট</p>
        </div>
        <div className="flex-1 rounded-[14px] border border-line bg-soft p-3.25 text-center">
          <p className="font-number text-xl font-bold text-ink">{trust.noShowCount}</p>
          <p className="text-[11px] text-muted">নো-শো</p>
        </div>
        <div className="flex-1 rounded-[14px] border border-line bg-soft p-3.25 text-center">
          <p className="font-number text-xl font-bold text-ink">{trust.regularShopCount}</p>
          <p className="text-[11px] text-muted">নিয়মিত দোকান</p>
        </div>
      </div>

      <p className="mt-5 mb-2.75 text-[13px] font-semibold tracking-wide text-muted uppercase">
        খরচের হিসাব
      </p>

      <div className="flex gap-2.25">
        <div className="flex-1 rounded-[18px] bg-ink p-4 text-paper">
          <p className="text-xs opacity-60">এই মাসে খরচ</p>
          <p className="mt-1 font-number text-2xl font-bold text-good">
            ৳{formatMoney(spending.month.amount)}
          </p>
          <p className="mt-1 text-[11px] opacity-50">
            {spending.month.changePct === null
              ? "গত মাসে কোনো খরচ ছিল না"
              : spending.month.changePct >= 0
                ? `▲ গত মাসের চেয়ে ${spending.month.changePct}%`
                : `▼ গত মাসের চেয়ে ${Math.abs(spending.month.changePct)}%`}
          </p>
        </div>
        <div className="flex-1 rounded-[18px] border border-line bg-card p-4">
          <p className="text-xs text-muted">সর্বমোট খরচ</p>
          <p className="mt-1 font-number text-2xl font-bold text-ink">
            ৳{formatMoney(spending.total.amount)}
          </p>
          <p className="mt-1 text-[11px] text-muted">{trust.visitCount} টি ভিজিট</p>
        </div>
      </div>

      <div className="mt-2.25 rounded-[18px] border border-line bg-card p-4">
        <div className="mb-3.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">গত ১২ মাসের খরচ</p>
          <p className="text-[11px] text-muted">৳ হাজারে</p>
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
          <p className="mb-3 text-[13px] font-semibold text-ink">দোকান অনুযায়ী খরচ</p>
          <div className="flex flex-col gap-2.75">
            {spending.byShop.map((s) => {
              const shop = shopsById[s.shopId];
              return (
                <div key={s.shopId} className="flex items-center gap-2.5">
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
                    style={{ background: shop ? shopAvatarColor(shop.id) : "var(--color-muted)" }}
                  >
                    {shop ? shopInitial(shop.name) : <Store className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[13px] text-ink">
                      <span className="truncate">{shop?.name ?? "দোকান"}</span>
                      <b className="font-number shrink-0">৳{formatMoney(s.amount)}</b>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="h-1.5 w-full max-w-[70%] rounded-md bg-soft">
                        <div
                          className="h-full rounded-md bg-accent"
                          style={{ width: `${Math.max(2, (s.amount / maxShopSpend) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted">{s.visitCount} বার</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-5 mb-2.75 text-[13px] font-semibold tracking-wide text-muted uppercase">
        সিরিয়াল হিস্টরি
      </p>

      {doneHistory.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          এখনো কোনো সিরিয়াল সম্পন্ন হয়নি।
        </div>
      ) : (
        <div className="flex flex-col gap-2.25">
          {doneHistory.map((s) => {
            const shop = shopsById[s.shop_id];
            const services = parseServicesSnapshot(s.services_snapshot);
            const rating = ratingsBySerial[s.id];
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-[14px] border border-line bg-card p-3.25"
              >
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display font-bold text-white"
                  style={{ background: shop ? shopAvatarColor(shop.id) : "var(--color-muted)" }}
                >
                  {shop ? shopInitial(shop.name) : <Store className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {shop?.name ?? "দোকান"}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {services.map((sv) => sv.name).join(" + ") || "—"} ·{" "}
                    {formatBanglaDate(new Date(s.completed_at ?? s.created_at))}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-number text-[13px] font-semibold text-ink">
                    ৳{formatMoney(s.total_amount)}
                  </p>
                  {rating ? (
                    <p className="text-[10px] text-brass">★ {rating}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReviewing(s)}
                      className="flex items-center gap-0.5 text-[10px] font-semibold text-accent"
                    >
                      <Star className="h-2.5 w-2.5" />
                      রিভিউ দাও
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reviewing && (
        <ReviewDialog
          shopId={reviewing.shop_id}
          serialId={reviewing.id}
          shopName={shopsById[reviewing.shop_id]?.name ?? "দোকান"}
          shopAvatarBg={
            shopsById[reviewing.shop_id] ? shopAvatarColor(reviewing.shop_id) : "var(--color-muted)"
          }
          shopInitial={
            shopsById[reviewing.shop_id] ? shopInitial(shopsById[reviewing.shop_id].name) : "?"
          }
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
