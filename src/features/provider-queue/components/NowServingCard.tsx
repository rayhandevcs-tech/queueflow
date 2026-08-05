"use client";

import { useState } from "react";
import { Users, X } from "lucide-react";
import { parseServicesSnapshot, type Serial } from "@/types";
import { CountdownRing } from "@/components/ui/CountdownRing";
import { LiveDot } from "@/components/ui/LiveDot";
import { useNowMs } from "@/hooks/use-now";
import { fmtMMSS, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { UiDbError } from "@/lib/supabase/db-errors";
import { useT } from "@/lib/i18n";
import type { useSerialActions } from "../hooks/use-serial-actions";
import { providerQueueDict } from "../lib/i18n";
import { partyInfo } from "../lib/party";
import { PaymentConfirmSheet } from "./PaymentConfirmSheet";

export function NowServingCard({
  serial,
  boardRows,
  actions,
}: {
  serial: Serial;
  boardRows: Serial[];
  actions: ReturnType<typeof useSerialActions>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [customExtend, setCustomExtend] = useState(false);
  const [customMin, setCustomMin] = useState("");
  const nowMs = useNowMs(1000);
  const services = parseServicesSnapshot(serial.services_snapshot);
  const t = useT(providerQueueDict);
  const party = partyInfo(serial, boardRows);

  const startedMs = serial.started_at ? new Date(serial.started_at).getTime() : nowMs;
  const totalSec = serial.estimated_duration_min * 60;
  const remainingSec = Math.max(0, (startedMs + totalSec * 1000 - nowMs) / 1000);
  const progress = totalSec > 0 ? remainingSec / totalSec : 0;

  const surface = (err: unknown) => {
    if (err instanceof UiDbError && err.silent) return;
    setError(err instanceof Error ? err.message : t("somethingWrong"));
  };

  const extend = (extraMin: number) => {
    if (extraMin <= 0) return;
    actions.extendTime.mutate(
      {
        serialId: serial.id,
        newDuration: serial.estimated_duration_min + extraMin,
        newExtended: serial.extended_min + extraMin,
      },
      { onError: surface },
    );
  };

  return (
    <div className="relative overflow-hidden rounded-[22px] bg-accent p-5.5 text-accent-ink">
      <button
        type="button"
        title={t("cancelTitle")}
        disabled={actions.cancel.isPending}
        onClick={() => {
          setError(null);
          actions.cancel.mutate(serial.id, { onError: surface });
        }}
        className="absolute top-4.5 right-4.5 text-accent-ink/30 hover:text-accent-ink/70"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3.5 flex items-center gap-2 text-xs text-accent-ink/60">
        <LiveDot />
        {t("nowServingPrefix")} · {t("serialHash", serial.position)}
      </div>

      <div className="flex items-center gap-4">
        <CountdownRing
          size={128}
          strokeWidth={10}
          progress={progress}
          className="shrink-0"
          ringClassName="stroke-accent-ink"
          trackClassName="stroke-accent-ink/20"
        >
          <div className="flex flex-col items-center">
            <span className="font-number text-[26px] leading-none font-bold tracking-tight">
              {fmtMMSS(remainingSec)}
            </span>
            <span className="mt-1 text-[10px] text-accent-ink/50">{t("remainingWord")}</span>
          </div>
        </CountdownRing>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-xl font-bold">
              {serial.party_member_name || serial.customer_name || "—"}
            </p>
            {party && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-ink/15 px-2 py-0.5 text-[10px] font-semibold">
                <Users className="h-2.5 w-2.5" />
                {t("partyBadge", party.index, party.size)}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-accent-ink/60">
            {services.map((s) => s.name).join(" + ") || "—"}
          </p>
          <p className="mt-4 font-number text-lg font-bold">৳{formatMoney(serial.total_amount)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {!customExtend ? (
          <>
            <button
              type="button"
              onClick={() => extend(5)}
              className="rounded-full bg-accent-ink/15 px-3 py-1.5 text-xs font-semibold text-accent-ink"
            >
              +{toBanglaDigits(5)}
            </button>
            <button
              type="button"
              onClick={() => extend(10)}
              className="rounded-full bg-accent-ink/15 px-3 py-1.5 text-xs font-semibold text-accent-ink"
            >
              +{toBanglaDigits(10)}
            </button>
            <button
              type="button"
              onClick={() => setCustomExtend(true)}
              className="rounded-full bg-accent-ink/15 px-3 py-1.5 text-xs font-semibold text-accent-ink"
            >
              {t("extendCustomLabel")}
            </button>
          </>
        ) : (
          <>
            <input
              type="number"
              min={1}
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              placeholder={t("extendCustomPlaceholder")}
              autoFocus
              className="w-20 rounded-lg bg-accent-ink/15 px-2 py-1.5 text-xs font-semibold text-accent-ink outline-none placeholder:text-accent-ink/50"
            />
            <button
              type="button"
              onClick={() => {
                extend(parseInt(customMin, 10) || 0);
                setCustomExtend(false);
                setCustomMin("");
              }}
              className="rounded-full bg-accent-ink px-3 py-1.5 text-xs font-semibold text-accent"
            >
              {t("extendConfirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomExtend(false);
                setCustomMin("");
              }}
              className="text-xs font-semibold text-accent-ink/60"
            >
              {t("extendCancel")}
            </button>
          </>
        )}
      </div>
      {serial.extended_min > 0 && (
        <p className="mt-1.5 text-[11px] text-accent-ink/50">{t("extendedByLabel", serial.extended_min)}</p>
      )}

      <button
        type="button"
        onClick={() => setPaymentOpen(true)}
        className="mt-4.5 w-full rounded-[14px] bg-accent-ink py-3.5 font-display text-[15px] font-bold text-accent disabled:opacity-60"
      >
        {t("jobDoneNext")}
      </button>

      {error && <p className="mt-2 text-xs text-accent-ink">{error}</p>}

      {paymentOpen && (
        <PaymentConfirmSheet
          serial={serial}
          actions={actions}
          onClose={() => setPaymentOpen(false)}
        />
      )}
    </div>
  );
}
