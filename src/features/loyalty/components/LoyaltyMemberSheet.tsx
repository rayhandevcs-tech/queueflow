"use client";

import { useState } from "react";
import { CalendarClock, Gift, Scissors, Share2, Sparkles, Wrench } from "lucide-react";
import type { LoyaltyAccount, LoyaltyTransactionKind } from "@/types";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Spinner } from "@/components/ui/Spinner";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import type { LoyaltyCustomerInfo } from "../api/loyalty.api";
import { useLoyaltyLedger } from "../hooks/use-loyalty";
import type { useLoyaltyActions } from "../hooks/use-loyalty";
import { loyaltyDict } from "../lib/i18n";
import { sortLedger } from "../lib/loyalty";

// Both maps are exhaustive over `LoyaltyTransactionKind` on purpose: adding a
// kind to the ledger is then a compile error here until this sheet can name
// it, rather than a row that renders with no label. That is exactly what
// happened when Sprint 8 widened the kind, and exactly what should happen.
const KIND_ICON: Record<LoyaltyTransactionKind, typeof Scissors> = {
  EARN_SERIAL: Scissors,
  EARN_APPOINTMENT: CalendarClock,
  ADJUST: Wrench,
  REFERRAL_REFERRER: Share2,
  REFERRAL_REFERRED: Gift,
};

const KIND_KEY = {
  EARN_SERIAL: "kindEARN_SERIAL",
  EARN_APPOINTMENT: "kindEARN_APPOINTMENT",
  ADJUST: "kindADJUST",
  REFERRAL_REFERRER: "kindREFERRAL_REFERRER",
  REFERRAL_REFERRED: "kindREFERRAL_REFERRED",
} as const satisfies Record<LoyaltyTransactionKind, string>;

/**
 * One customer's points, and how they got there.
 *
 * The ledger is the whole point of this sheet. A balance on its own invites
 * "are you sure?"; a list of the jobs that produced it doesn't. It is also
 * the only place the manual correction lives, so an owner cannot change a
 * number without seeing the history they are changing.
 */
export function LoyaltyMemberSheet({
  account,
  person,
  actions,
  onClose,
}: {
  account: LoyaltyAccount;
  person: LoyaltyCustomerInfo | undefined;
  actions: ReturnType<typeof useLoyaltyActions>;
  onClose: () => void;
}) {
  const t = useT(loyaltyDict);
  const [adjusting, setAdjusting] = useState(false);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");

  const ledger = useLoyaltyLedger(account.shop_id, account.customer_id);
  const rows = sortLedger(ledger.data ?? []);
  const num = (n: number) => toBanglaDigits(n);

  const parsed = Number(points);
  const canSubmit =
    points.trim() !== "" && Number.isInteger(parsed) && parsed !== 0 && !actions.adjust.isPending;

  return (
    <BottomSheet open onClose={onClose} title={t("drawerTitle")} maxWidthClassName="max-w-md">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <AvatarChip
            label={person?.name}
            avatarUrl={person?.avatarUrl ?? null}
            shape="circle"
            size={44}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-bold text-ink">
              {person?.name || t("noName")}
            </p>
            {person?.phone && (
              <p className="truncate font-number text-[12px] text-muted">{person.phone}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-[26px] leading-none font-bold text-accent">
              {num(account.balance)}
            </p>
            <p className="text-[10px] text-muted">{t("cardLifetime", num(account.lifetime_earned))}</p>
          </div>
        </div>

        {/* ---- manual correction ---- */}
        {adjusting ? (
          <div className="space-y-2.5 rounded-2xl border border-line bg-soft p-3.5">
            <p className="text-[13px] font-semibold text-ink">{t("adjustTitle")}</p>
            <p className="text-[11px] leading-snug text-muted">{t("adjustHint")}</p>
            <Field label={t("adjustPointsLabel")}>
              <Input
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                type="number"
                inputMode="numeric"
                placeholder="+5 / -3"
              />
            </Field>
            <Field label={t("adjustNoteLabel")}>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("adjustNotePlaceholder")}
                maxLength={200}
              />
            </Field>
            {actions.adjust.isError && (
              <p className="text-sm text-live">
                {actions.adjust.error instanceof Error
                  ? actions.adjust.error.message
                  : t("loadFailed")}
              </p>
            )}
            <p className="text-[11px] leading-snug text-muted">{t("adjustNotRedemption")}</p>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  actions.adjust.mutate(
                    { customerId: account.customer_id, points: parsed, note },
                    {
                      onSuccess: () => {
                        setAdjusting(false);
                        setPoints("");
                        setNote("");
                      },
                    },
                  )
                }
                disabled={!canSubmit}
                loading={actions.adjust.isPending}
              >
                {t("adjustSubmit")}
              </Button>
              <Button variant="outline" onClick={() => setAdjusting(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="soft" onClick={() => setAdjusting(true)} className="w-full">
            <Wrench className="h-4 w-4" />
            {t("adjustCta")}
          </Button>
        )}

        {/* ---- the ledger ---- */}
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-ink">{t("historyHeading")}</p>

          {ledger.isPending ? (
            <div className="grid min-h-20 place-items-center">
              <Spinner className="h-5 w-5 text-muted" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-muted">{t("historyEmpty")}</p>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-line">
              {rows.map((row) => {
                const Icon = KIND_ICON[row.kind] ?? Sparkles;
                const positive = row.points > 0;
                return (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 border-b border-line bg-card p-3 last:border-0"
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                        positive ? "bg-good-soft text-good" : "bg-live-soft text-live",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {t(KIND_KEY[row.kind])}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {[
                          formatBanglaDate(new Date(row.created_at)),
                          row.bill_amount != null
                            ? t("fromBill", formatMoney(row.bill_amount))
                            : null,
                          row.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 font-display text-[15px] font-bold",
                        positive ? "text-good" : "text-live",
                      )}
                    >
                      {positive ? "+" : "−"}
                      {num(Math.abs(row.points))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
