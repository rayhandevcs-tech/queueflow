"use client";

import { useState } from "react";
import { Bell, MessageCircle, Users } from "lucide-react";
import { formatBanglaDate } from "@/lib/format-wait";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useRegulars } from "../hooks/use-regulars";
import { providerRegularsDict } from "../lib/i18n";

export function RegularsView({ shopId }: { shopId: string | undefined }) {
  const { regulars, sentKeys, remind, isPending } = useRegulars(shopId);
  const showToast = useToast();
  const [justSent, setJustSent] = useState<Set<string>>(new Set());
  const t = useT(providerRegularsDict);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("regularCustomersTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">{t("regularsSubtitle")}</p>
      </div>

      {regulars.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={t("noRegularsTitle")}
          description={t("noRegularsDesc")}
        />
      ) : (
        <div className="flex flex-col gap-2.75">
          {regulars.map((r) => {
            const sent = sentKeys.has(r.key) || justSent.has(r.key);
            return (
              <div
                key={r.key}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-card p-4"
              >
                <div
                  className="grid h-11.5 w-11.5 shrink-0 place-items-center rounded-[14px] font-display text-lg font-bold text-white"
                  style={{ background: shopAvatarColor(r.key) }}
                >
                  {shopInitial(r.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold text-ink">{r.name}</p>
                  <p className="text-xs text-muted">
                    {t("lastVisitedSummary", formatBanglaDate(new Date(r.lastVisitAt)), r.visitCount)}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    color: r.visitedThisMonth ? "var(--color-good)" : "var(--color-live)",
                    background: r.visitedThisMonth ? "var(--color-good-soft)" : "var(--color-live-soft)",
                  }}
                >
                  {r.visitedThisMonth ? t("visitedThisMonth") : t("notVisited")}
                </span>

                {r.visitedThisMonth ? (
                  <button
                    type="button"
                    onClick={() => showToast(t("messageFeatureSoon"))}
                    className="flex min-w-30 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-line px-3.5 py-2.25 text-sm font-semibold text-ink"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t("sendMessage")}
                  </button>
                ) : sent ? (
                  <button
                    type="button"
                    disabled
                    className="flex min-w-30 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-line px-3.5 py-2.25 text-sm font-semibold text-muted"
                  >
                    {t("alreadySent")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={remind.isPending}
                    onClick={() => {
                      if (!shopId) return;
                      remind.mutate(
                        { shopId, customerId: r.customerId, customerPhone: r.customerPhone },
                        {
                          onSuccess: () => {
                            setJustSent((prev) => new Set(prev).add(r.key));
                            showToast(t("reminderSent"));
                          },
                          onError: () => {
                            showToast(t("reminderNotReady"));
                          },
                        },
                      );
                    }}
                    className="flex min-w-30 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.25 text-sm font-semibold text-accent-ink disabled:opacity-60"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {t("sendReminder")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
