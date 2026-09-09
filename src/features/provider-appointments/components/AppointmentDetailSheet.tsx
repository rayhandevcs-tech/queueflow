"use client";

import { CalendarClock, Coins, Scissors } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { useT } from "@/lib/i18n";
import { formatBanglaTime, toBanglaDigits } from "@/lib/format-wait";
import { formatDuration } from "@/lib/duration";
import { STATUS_LABEL_KEY } from "../lib/status";
import { canTransition, isTerminal, primaryAction } from "../lib/status-machine";
import { providerAppointmentsDict } from "../lib/i18n";
import type { AppointmentCard, AppointmentStatus } from "../lib/types";

/**
 * One appointment, and what can be done to it next.
 *
 * The buttons are drawn from `status-machine.ts`, which mirrors the database's
 * own transition table — so the sheet never offers a move that would be
 * refused. It is still the database that decides: a racing tap loses there,
 * and the board re-reads.
 */
export function AppointmentDetailSheet({
  appointment,
  busy,
  onClose,
  onSetStatus,
}: {
  appointment: AppointmentCard | null;
  busy: boolean;
  onClose: () => void;
  onSetStatus: (status: AppointmentStatus) => void;
}) {
  const t = useT(providerAppointmentsDict);
  if (!appointment) return null;

  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const next = primaryAction(appointment.status);
  const done = isTerminal(appointment.status);

  return (
    <BottomSheet open onClose={onClose} title={t("detailTitle")}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <AvatarChip
            label={appointment.customerName}
            avatarUrl={appointment.customerAvatarUrl}
            shape="circle"
            size={44}
          />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold text-ink">
              {appointment.customerName || t("noCustomerName")}
            </p>
            <p className="text-[12px] text-muted">{t(STATUS_LABEL_KEY[appointment.status])}</p>
          </div>
        </div>

        <dl className="space-y-2.5 rounded-2xl border border-line bg-soft p-3.5">
          <Row
            icon={<CalendarClock className="h-4 w-4" />}
            label={t("detailWhen")}
            value={`${formatBanglaTime(start)} – ${formatBanglaTime(end)} · ${formatDuration(minutes)}`}
          />
          <Row
            icon={<Scissors className="h-4 w-4" />}
            label={t("detailServices")}
            value={appointment.serviceNames.join(", ") || "—"}
          />
          <Row
            icon={<Coins className="h-4 w-4" />}
            label={t("detailPrice")}
            value={`৳${toBanglaDigits(appointment.totalAmount)}`}
          />
        </dl>

        {done ? (
          <p className="text-center text-[13px] text-muted">{t("detailFinished")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {next && (
              <Button onClick={() => onSetStatus(next)} loading={busy}>
                {t(STATUS_LABEL_KEY[next])}
              </Button>
            )}
            {canTransition(appointment.status, "NO_SHOW") && (
              <Button variant="outline" onClick={() => onSetStatus("NO_SHOW")} disabled={busy}>
                {t(STATUS_LABEL_KEY.NO_SHOW)}
              </Button>
            )}
            {canTransition(appointment.status, "CANCELLED") && (
              <Button variant="danger" onClick={() => onSetStatus("CANCELLED")} disabled={busy}>
                {t(STATUS_LABEL_KEY.CANCELLED)}
              </Button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium text-muted">{label}</dt>
        <dd className="text-sm font-semibold break-words text-ink">{value}</dd>
      </div>
    </div>
  );
}
