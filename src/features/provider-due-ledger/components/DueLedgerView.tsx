"use client";

import { useState } from "react";
import { Bell, Check, Wallet } from "lucide-react";
import { formatBanglaDate, formatMoney } from "@/lib/format-wait";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useDueLedger } from "../hooks/use-due-ledger";
import { providerDueLedgerDict } from "../lib/i18n";

export function DueLedgerView({ shopId }: { shopId: string | undefined }) {
  const { groups, totalDue, isPending, collect, remind } = useDueLedger(shopId);
  const showToast = useToast();
  const [justReminded, setJustReminded] = useState<Set<string>>(new Set());
  const t = useT(providerDueLedgerDict);

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
        <h1 className="font-display text-[27px] font-bold text-ink">{t("dueLedgerTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {groups.length === 0
            ? t("noOneOwes")
            : t("totalDueSummary", formatMoney(totalDue), groups.length)}
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title={t("emptyLedgerTitle")}
          description={t("emptyLedgerDesc")}
        />
      ) : (
        <div className="flex flex-col gap-2.75">
          {groups.map((g) => {
            const reminded = justReminded.has(g.key);
            const canRemind = g.remindableSerialIds.length > 0 && !reminded;
            return (
              <div
                key={g.key}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-card p-4"
              >
                <div
                  className="grid h-11.5 w-11.5 shrink-0 place-items-center rounded-[14px] font-display text-lg font-bold text-white"
                  style={{ background: shopAvatarColor(g.key) }}
                >
                  {shopInitial(g.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold text-ink">{g.name}</p>
                  <p className="text-xs text-muted">
                    {g.oldestDueAt ? t("dueSince", formatBanglaDate(new Date(g.oldestDueAt))) : "—"}
                    {g.serialIds.length > 1 ? ` · ${t("timesSuffix", g.serialIds.length)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-live-soft px-3 py-1 font-number text-sm font-bold text-live">
                  ৳{formatMoney(g.totalDue)}
                </span>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canRemind || remind.isPending}
                    title={reminded ? t("alreadyRemindedToday") : t("sendReminderTitle")}
                    onClick={() => {
                      remind.mutate(g.remindableSerialIds, {
                        onSuccess: () => {
                          setJustReminded((prev) => new Set(prev).add(g.key));
                          showToast(t("reminderSent"));
                        },
                        onError: (err) =>
                          showToast(
                            err instanceof Error && err.message
                              ? err.message
                              : t("reminderFailedGeneric"),
                          ),
                      });
                    }}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted disabled:opacity-40"
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={collect.isPending}
                    onClick={() => {
                      collect.mutate(g.serialIds, {
                        onSuccess: () => showToast(t("markedCollected")),
                        onError: () => showToast(t("markFailed")),
                      });
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-good px-3.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t("markCollected")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
