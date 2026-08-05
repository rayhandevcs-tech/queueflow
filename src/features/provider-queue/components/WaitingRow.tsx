"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, ChevronsDown, MessageCircle, Phone, Play, Users, UserX } from "lucide-react";
import { parseServicesSnapshot, type Serial } from "@/types";
import { useNowMs } from "@/hooks/use-now";
import { fmtWait, formatMoney } from "@/lib/format-wait";
import { UiDbError } from "@/lib/supabase/db-errors";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
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
      <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-base font-bold text-ink">
              {serial.party_member_name || serial.customer_name || "—"}
            </span>
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
          <p className="mt-0.5 truncate text-xs text-muted">
            {services.map((s) => s.name).join(" + ") || "—"}
          </p>
        </div>
        <div className="min-w-19.5 text-center">
          <p className="text-[11px] text-muted">{t("startsInLabel")}</p>
          <p className="font-number text-base font-bold text-live">
            {fmtWait(startsInSec).label}
          </p>
        </div>
        <div className="min-w-13.5 text-right font-number text-[15px] font-semibold text-ink">
          ৳{formatMoney(serial.total_amount)}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5">
        {serial.customer_phone && (
          <a
            href={`tel:${serial.customer_phone}`}
            className="flex items-center gap-1 text-xs font-medium text-accent"
          >
            <Phone className="h-3 w-3" />
            {serial.customer_phone}
          </a>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {serial.customer_id && (
            <button
              type="button"
              title={t("messageCustomerTitle")}
              onClick={() => router.push(`/chat/${serial.customer_id}`)}
              className="grid h-7 w-7 place-items-center rounded-lg bg-soft text-muted hover:text-ink"
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
                "flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-xs font-semibold text-accent-ink disabled:opacity-50",
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
              className="flex h-7 items-center gap-1 rounded-lg bg-brass-soft px-2.5 text-xs font-semibold text-brass disabled:opacity-50"
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
            className="grid h-7 w-7 place-items-center rounded-lg bg-soft text-muted hover:text-ink disabled:opacity-50"
          >
            <ChevronsDown className="h-3.5 w-3.5" />
          </button>
          {canNoShow && (
            <button
              type="button"
              title={t("noShowTitle")}
              disabled={actions.noShow.isPending}
              onClick={() => run(() => actions.noShow.mutate(serial.id, { onError: surface }))}
              className="grid h-7 w-7 place-items-center rounded-lg bg-live-soft text-live disabled:opacity-50"
            >
              <UserX className="h-3.5 w-3.5" />
            </button>
          )}
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
    </div>
  );
}
