"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Store } from "lucide-react";
import { keys } from "@/lib/query/keys";
import { useT } from "@/lib/i18n";
import { formatBanglaDate, formatBanglaTime, toBanglaDigits } from "@/lib/format-wait";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cancelMyAppointment } from "../api/appointments.api";
import { useMyAppointments } from "../hooks/use-appointment-booking";
import { customerBookingDict } from "../lib/i18n";

/** Statuses that still have a future — the ones worth showing as "coming up". */
const UPCOMING = new Set(["BOOKED", "CONFIRMED", "IN_PROGRESS"]);

/**
 * The customer's upcoming appointments, above the live queue tracker.
 *
 * Renders **nothing at all** when there are none, which is the whole reason
 * it can sit on a shared screen: a salon customer's page is byte-for-byte
 * what it was before this existed.
 */
export function MyAppointmentsList() {
  const t = useT(customerBookingDict);
  const showToast = useToast();
  const queryClient = useQueryClient();
  const { data } = useMyAppointments();

  const cancel = useMutation({
    mutationFn: cancelMyAppointment,
    onSuccess: () => {
      showToast(t("apptCancelledToast"));
      void queryClient.invalidateQueries({ queryKey: keys.appointments.mine() });
    },
  });

  const upcoming = (data ?? [])
    .filter((a) => UPCOMING.has(a.status) && new Date(a.ends_at) > new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  if (upcoming.length === 0) return null;

  return (
    <section className="mb-5 space-y-2.5">
      <h2 className="text-[13px] font-semibold text-muted">{t("apptUpcomingHeading")}</h2>

      {upcoming.map((appointment) => {
        const start = new Date(appointment.starts_at);
        const end = new Date(appointment.ends_at);
        return (
          <Card key={appointment.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
                  <Store className="h-3.5 w-3.5 shrink-0 text-muted" />
                  {appointment.shops?.name ?? "—"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-number">
                    {formatBanglaDate(start)} · {formatBanglaTime(start)} – {formatBanglaTime(end)}
                  </span>
                </p>
                <p className="mt-1 font-number text-[13px] font-semibold text-ink">
                  ৳{toBanglaDigits(appointment.total_amount)}
                </p>
              </div>
              <Badge variant={appointment.status === "CONFIRMED" ? "good" : "accent"}>
                {t(
                  appointment.status === "CONFIRMED"
                    ? "apptStatusConfirmed"
                    : appointment.status === "IN_PROGRESS"
                      ? "apptStatusInProgress"
                      : "apptStatusBooked",
                )}
              </Badge>
            </div>

            {/* Once the work has started, cancelling is a conversation with
                the shop, not a button. */}
            {appointment.status !== "IN_PROGRESS" && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 -ml-2"
                loading={cancel.isPending && cancel.variables === appointment.id}
                onClick={() => cancel.mutate(appointment.id)}
              >
                {t("apptCancelCta")}
              </Button>
            )}
          </Card>
        );
      })}
    </section>
  );
}
