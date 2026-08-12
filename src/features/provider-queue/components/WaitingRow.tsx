"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, ChevronsDown, MessageCircle, Phone, Play, Users, UserX, X } from "lucide-react";
import { parseServicesSnapshot, type Serial } from "@/types";
import { useNowMs } from "@/hooks/use-now";
import { fmtWait, formatMoney } from "@/lib/format-wait";
import { UiDbError } from "@/lib/supabase/db-errors";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useT } from "@/lib/i18n";
import type { Lane } from "../lib/lanes";
import type { useSerialActions } from "../hooks/use-serial-actions";
import { providerQueueDict } from "../lib/i18n";
import { partyInfo } from "../lib/party";
import { MoveSerialMenu } from "./MoveSerialMenu";

/** Must match the window serial_before_update enforces (20260827_wait_reality.sql). */
const GRACE_MS = 5 * 60_000;

export function WaitingRow({
  serial,
  canStart,
  lanes,
  boardRows,
  actions,
}: {
  serial: Serial;
  canStart: boolean;
  lanes: Lane[];
  boardRows: Serial[];
  actions: ReturnType<typeof useSerialActions>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const nowMs = useNowMs(30_000);
  const services = parseServicesSnapshot(serial.services_snapshot);
  const t = useT(providerQueueDict);

  const startsInSec = serial.estimated_start_at
    ? (new Date(serial.estimated_start_at).getTime() - nowMs) / 1000
    : 0;

  const arrived = !!serial.arrived_at;
  const called = !!serial.called_at;
  const party = partyInfo(serial, boardRows);
  // Mirrors the 5-minute window serial_before_update enforces — the button is
  // hidden rather than disabled until then, so nobody hunts for why it fails.
  const graceLeftMin = serial.called_at
    ? Math.max(
        0,
        Math.ceil((new Date(serial.called_at).getTime() + GRACE_MS - nowMs) / 60_000),
      )
    : GRACE_MS / 60_000;
  const canNoShow = called && graceLeftMin === 0;

  const surface = (err: unknown) => {
    if (err instanceof UiDbError && err.silent) return;
    setError(err instanceof Error ? err.message : t("somethingWrong"));
  };
  const run = (fn: () => void) => {
    setError(null);
    fn();
  };

  return (
    <div className="rounded-2xl border border-accent/15 bg-accent/10 p-3.5">
      {/* LAYOUT NOTE (Sprint 39)
          This was one flex row: avatar · name+services · starts-in · price.
          On a phone the name column is the only flexible one, so it absorbed
          every pixel the fixed columns needed and truncated to nothing — the
          customer's name, the single most important thing on the card,
          disappeared entirely while badges and the price stayed. The identity
          block now owns its own row and the numbers sit underneath, so nothing
          competes with the name for width at any viewport. */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <AvatarChip
            label={serial.customer_name}
            avatarUrl={serial.customer_avatar_url}
            shape="circle"
            size={38}
          />
          <span className="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-ink font-number text-[10px] font-bold text-white">
            {serial.position}
          </span>
          {/* The whole point of check-in: at a glance, is this person here or
              still at home? Everything else on this card was already known. */}
          {arrived && (
            <span
              title={t("arrivedTitle")}
              className="absolute -top-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-card bg-good"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {/* The name gets a line to itself; the badges wrap under it rather
              than pushing it out of existence. */}
          <p className="truncate font-display text-base font-bold text-ink">
            {serial.party_member_name || serial.customer_name || "—"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {/* Tells the owner not to call the next customer in yet — more of
                this family is still on the board. */}
            {party && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                <Users className="h-2.5 w-2.5" />
                {t("partyBadge", party.index, party.size)}
              </span>
            )}
            {serial.is_walk_in && (
              <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-[10px] font-semibold text-muted">
                {t("walkInBadge")}
              </span>
            )}
            {serial.advance_paid && (
              <span className="shrink-0 rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-semibold text-good">
                {t("advancePaidBadge")}
              </span>
            )}
            {arrived && (
              <span className="shrink-0 rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-semibold text-good">
                {t("arrivedBadge")}
              </span>
            )}
            {called && (
              <span className="shrink-0 rounded-full bg-brass-soft px-2 py-0.5 text-[10px] font-semibold text-brass">
                {graceLeftMin > 0 ? t("calledCountdown", graceLeftMin) : t("calledBadge")}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted">
            {services.map((s) => s.name).join(" + ") || "—"}
          </p>
        </div>
      </div>

      {/* The two figures, on their own line and never in competition with the
          name. They sit right-aligned on wider cards and stay put on narrow
          ones — no wrapping mid-number, no overlap. */}
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted">{t("startsInLabel")}</p>
          <p className="font-number text-base font-bold text-live tabular-nums">
            {fmtWait(startsInSec).label}
          </p>
        </div>
        <p className="font-number text-[15px] font-semibold text-ink tabular-nums">
          ৳{formatMoney(serial.total_amount)}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
        {serial.customer_phone && (
          <a
            href={`tel:${serial.customer_phone}`}
            className="flex items-center gap-1 text-xs font-medium text-accent"
          >
            <Phone className="h-3 w-3" />
            {serial.customer_phone}
          </a>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {serial.customer_id && (
            <button
              type="button"
              title={t("messageCustomerTitle")}
              onClick={() => router.push(`/chat/${serial.customer_id}`)}
              className="grid h-9 w-9 place-items-center rounded-lg bg-soft text-muted hover:text-ink"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
          )}
          {canStart && (
            <button
              type="button"
              disabled={actions.start.isPending}
              onClick={() => run(() => actions.start.mutate(serial.id, { onError: surface }))}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-semibold text-accent-ink disabled:opacity-50",
              )}
            >
              <Play className="h-3 w-3 fill-current" />
              {t("startCta")}
            </button>
          )}
          {!called && (
            <button
              type="button"
              title={t("callTitle")}
              disabled={actions.call.isPending}
              onClick={() => run(() => actions.call.mutate(serial.id, { onError: surface }))}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-brass-soft px-2.5 text-xs font-semibold text-brass disabled:opacity-50"
            >
              <BellRing className="h-3 w-3" />
              {t("callCta")}
            </button>
          )}
          {/* The kind option, and the one a real shop reaches for first:
              push them one place back instead of ending their booking. */}
          <button
            type="button"
            title={t("bumpBackTitle")}
            disabled={actions.bumpBack.isPending}
            onClick={() => run(() => actions.bumpBack.mutate(serial.id, { onError: surface }))}
            className="grid h-9 w-9 place-items-center rounded-lg bg-soft text-muted hover:text-ink disabled:opacity-50"
          >
            <ChevronsDown className="h-3.5 w-3.5" />
          </button>
          {canNoShow && (
            <button
              type="button"
              title={t("noShowTitle")}
              disabled={actions.noShow.isPending}
              onClick={() => run(() => actions.noShow.mutate(serial.id, { onError: surface }))}
              className="grid h-9 w-9 place-items-center rounded-lg bg-live-soft text-live disabled:opacity-50"
            >
              <UserX className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Cancelling a waiting serial was only possible once it had been
              started (the × on NowServingCard), so a booking that shouldn't be
              in the queue at all could only be no-showed — which needs a call
              and a five-minute wait, and marks the customer's record for
              something they never did. WAITING → CANCELLED is a legal move in
              serial_before_update, so it belongs here. */}
          <button
            type="button"
            title={t("cancelTitle")}
            disabled={actions.cancel.isPending}
            onClick={() => setConfirmCancel(true)}
            className="grid h-9 w-9 place-items-center rounded-lg bg-live-soft text-live disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <MoveSerialMenu
            serial={serial}
            lanes={lanes}
            moving={actions.move.isPending}
            onMove={(targetChairId) =>
              run(() => actions.move.mutate({ serialId: serial.id, targetChairId }, { onError: surface }))
            }
          />
        </div>
      </div>

      {error && <p className="mt-1.5 text-xs text-live">{error}</p>}

      <ConfirmSheet
        open={confirmCancel}
        title={t("cancelSerialTitle")}
        description={t("cancelSerialDesc")}
        confirmLabel={t("cancelSerialConfirm")}
        cancelLabel={t("keepSerial")}
        loading={actions.cancel.isPending}
        onConfirm={() =>
          run(() =>
            actions.cancel.mutate(serial.id, {
              onError: surface,
              onSettled: () => setConfirmCancel(false),
            }),
          )
        }
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
