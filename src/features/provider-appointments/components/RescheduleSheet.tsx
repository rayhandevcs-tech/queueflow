"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { keys } from "@/lib/query/keys";
import { ymd } from "@/lib/day-key";
import { useT } from "@/lib/i18n";
import { formatBanglaDate, formatBanglaTime } from "@/lib/format-wait";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { getSlotsForReschedule } from "../api/availability.api";
import { useRescheduleAppointment } from "../hooks/use-staff-availability";
import { providerAppointmentsDict } from "../lib/i18n";
import type { AppointmentCard } from "../lib/types";

const DAYS_AHEAD = 14;

/**
 * Moving one appointment.
 *
 * The times offered come from the same `shop_available_slots()` the customer
 * books through, so the owner cannot move someone onto a slot the database
 * would refuse for staff hours, leave, or another booking. And as everywhere
 * else, the list is a snapshot: the constraint still has the last word, which
 * is why a refusal clears the choice instead of retrying.
 */
export function RescheduleSheet({
  shopId,
  appointment,
  serviceIds,
  onClose,
  onMoved,
}: {
  shopId: string;
  appointment: AppointmentCard;
  /** The appointment's own services — slot length must not change on a move. */
  serviceIds: string[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const t = useT(providerAppointmentsDict);
  const [day, setDay] = useState(() => new Date(appointment.startsAt));
  const [chosen, setChosen] = useState<string | null>(null);
  const move = useRescheduleAppointment(shopId);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, []);

  const { data: slots, isPending } = useQuery({
    queryKey: keys.appointments.slots(shopId, ymd(day), serviceIds, appointment.staffId),
    queryFn: () => getSlotsForReschedule(shopId, day, serviceIds, appointment.staffId),
    enabled: serviceIds.length > 0,
  });

  return (
    <BottomSheet open onClose={onClose} title={t("rescheduleTitle")} maxWidthClassName="max-w-md">
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 rounded-xl bg-soft px-3 py-2 text-[12px] text-muted">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          {formatBanglaDate(new Date(appointment.startsAt))} ·{" "}
          {formatBanglaTime(new Date(appointment.startsAt))} →
        </p>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            <CalendarDays className="h-3.5 w-3.5" />
            {t("boardTitle")}
          </p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {days.map((d) => {
              const on = d.toDateString() === day.toDateString();
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    setDay(d);
                    setChosen(null);
                  }}
                  aria-pressed={on}
                  className={cn(
                    "min-h-11 shrink-0 rounded-xl border px-3 font-number text-[13px] font-semibold",
                    on
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line bg-card text-muted hover:border-accent/40",
                  )}
                >
                  {formatBanglaDate(d)}
                </button>
              );
            })}
          </div>
        </div>

        {isPending ? (
          <div className="grid min-h-20 place-items-center">
            <Spinner className="h-5 w-5 text-muted" />
          </div>
        ) : (slots ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[13px] text-muted">
            {t("rescheduleNone")}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {(slots ?? []).map((slot) => {
              const on = chosen === slot.startsAt;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => setChosen(slot.startsAt)}
                  aria-pressed={on}
                  className={cn(
                    "min-h-11 rounded-xl border px-2 font-number text-[13px] font-semibold",
                    on
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line bg-card text-ink hover:border-accent/40",
                  )}
                >
                  {formatBanglaTime(new Date(slot.startsAt))}
                </button>
              );
            })}
          </div>
        )}

        {move.isError && (
          <p className="text-sm text-live">
            {move.error instanceof Error ? move.error.message : t("boardLoadFailed")}
          </p>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={!chosen}
          loading={move.isPending}
          onClick={() => {
            if (!chosen) return;
            move.mutate(
              { appointmentId: appointment.id, startsAt: chosen },
              {
                onSuccess: onMoved,
                // A refusal means the grid is stale — drop the pick rather
                // than letting the same button be pressed again.
                onError: () => setChosen(null),
              },
            );
          }}
        >
          {chosen
            ? t("rescheduleConfirm", formatBanglaTime(new Date(chosen)))
            : t("rescheduleTitle")}
        </Button>
      </div>
    </BottomSheet>
  );
}
