"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBanglaDate, formatMoney } from "@/lib/format-wait";
import { toWhatsAppLink } from "@/lib/phone";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useDueLedger } from "../hooks/use-due-ledger";
import { providerDueLedgerDict } from "../lib/i18n";

export function DueLedgerView({ shopId }: { shopId: string | undefined }) {
  const { groups, manualEntries, totalDue, isPending, collect, collectManual, remind } =
    useDueLedger(shopId);
  const router = useRouter();
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

  const isEmpty = groups.length === 0 && manualEntries.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("dueLedgerTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {isEmpty
            ? t("noOneOwes")
            : t("totalDueSummary", formatMoney(totalDue), groups.length + manualEntries.length)}
        </p>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<span className="font-display text-2xl font-extrabold">৳</span>}
          title={t("emptyLedgerTitle")}
          description={t("emptyLedgerDesc")}
        />
      ) : (
        <div className="space-y-5">
        {groups.length > 0 && (
        <div className="flex flex-col gap-2.75">
          {groups.map((g) => {
            const reminded = justReminded.has(g.key);
            const canRemind = g.remindableSerialIds.length > 0 && !reminded;
            return (
              <div key={g.key} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center gap-3">
                  <AvatarChip label={g.name} avatarUrl={g.avatarUrl} shape="circle" size={46} />
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
                </div>

                <div className="mt-3 flex items-center gap-1.5">
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
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-muted disabled:opacity-40"
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={!g.customerId}
                    title={t("messageReminderTitle")}
                    onClick={() => g.customerId && router.push(`/chat/${g.customerId}`)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-muted disabled:opacity-40"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>

                  <a
                    href={g.phone ? toWhatsAppLink(g.phone, t("whatsappDueMessage", formatMoney(g.totalDue))) : "#"}
                    target={g.phone ? "_blank" : undefined}
                    rel="noreferrer"
                    title={t("whatsappReminderTitle")}
                    onClick={(e) => {
                      if (!g.phone) e.preventDefault();
                    }}
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line",
                      g.phone ? "text-[#25D366]" : "pointer-events-none text-muted opacity-40",
                    )}
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5" />
                  </a>

                  <button
                    type="button"
                    disabled={collect.isPending}
                    onClick={() => {
                      collect.mutate(g.serialIds, {
                        onSuccess: () => showToast(t("markedCollected")),
                        onError: () => showToast(t("markFailed")),
                      });
                    }}
                    className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-good px-3.5 text-sm font-semibold text-white disabled:opacity-50"
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

        {manualEntries.length > 0 && (
          <div>
            <p className="mb-2.75 text-xs font-semibold tracking-wide text-muted uppercase">
              {t("manualEntriesSectionTitle")}
            </p>
            <div className="flex flex-col gap-2.75">
              {manualEntries.map((e) => (
                <div key={e.id} className="rounded-2xl border border-line bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-bold text-ink">
                        {e.customer_name || t("manualEntryFallbackName")}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {t("dueSince", formatBanglaDate(new Date(e.created_at)))}
                        {e.service_name ? ` · ${e.service_name}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-live-soft px-3 py-1 font-number text-sm font-bold text-live">
                      ৳{formatMoney(e.amount)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={collectManual.isPending}
                      onClick={() => {
                        collectManual.mutate([e.id], {
                          onSuccess: () => showToast(t("markedCollected")),
                          onError: () => showToast(t("markFailed")),
                        });
                      }}
                      className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-good px-3.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t("markCollected")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
