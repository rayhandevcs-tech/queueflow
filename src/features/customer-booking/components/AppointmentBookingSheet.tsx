"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Users } from "lucide-react";
import type { Chair, Service } from "@/types";
import { cn } from "@/lib/utils";
import { useLanguage, useT } from "@/lib/i18n";
import { formatBanglaDate, formatBanglaTime, toBanglaDigits } from "@/lib/format-wait";
import { formatDuration } from "@/lib/duration";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { useAvailableSlots, useBookAppointment } from "../hooks/use-appointment-booking";
import { customerBookingDict } from "../lib/i18n";
import type { Slot } from "../api/appointments.api";

/** How far ahead a customer can book. Two weeks is plenty for a parlour. */
const DAYS_AHEAD = 14;

/**
 * Date → beautician → time → confirm.
 *
 * Every slot on this screen came from `shop_available_slots()`, and none of
 * them is a reservation. The customer cannot type a time, and cannot select
 * one that was not returned — but the booking is still validated again on
 * insert, because between drawing this grid and tapping confirm someone else
 * may have taken the slot. That second refusal is the one that counts.
 */
export function AppointmentBookingSheet({
  shopId,
  services,
  staff,
  onClose,
  onBooked,
}: {
  shopId: string;
  /** The services the customer already selected on the shop page. */
  services: Service[];
  /** Active staff, for the optional "who" filter. */
  staff: Chair[];
  onClose: () => void;
  onBooked: () => void;
}) {
  const t = useT(customerBookingDict);
  const { language } = useLanguage();
  const en = language === "en";

  const [day, setDay] = useState(() => new Date());
  const [staffId, setStaffId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);

  const serviceIds = useMemo(() => services.map((s) => s.id), [services]);
  const totalMin = services.reduce((a, s) => a + s.default_duration_min, 0);
  const totalAmount = services.reduce((a, s) => a + s.rate, 0);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, []);

  const { data: slots, isPending, isError } = useAvailableSlots(
    shopId,
    day,
    serviceIds,
    staffId,
  );
  const book = useBookAppointment(shopId);

  // One row per time, so the customer picks a time and not a person — the
  // beautician is a filter above, not a second grid to cross-reference.
  const byTime = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots ?? []) {
      const list = map.get(slot.startsAt);
      if (list) list.push(slot);
      else map.set(slot.startsAt, [slot]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const confirm = () => {
    if (!chosen) return;
    book.mutate(
      {
        shopId,
        staffId: chosen.staffId,
        serviceIds,
        startsAt: chosen.startsAt,
      },
      {
        onSuccess: onBooked,
        // A refusal means the grid is stale; drop the choice so the customer
        // cannot tap confirm again on a slot that is now gone.
        onError: () => setChosen(null),
      },
    );
  };

  return (
    <BottomSheet open onClose={onClose} title={t("apptSheetTitle")} maxWidthClassName="max-w-md">
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-1.5 rounded-xl bg-soft px-3 py-2 text-[12px] text-muted">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          {t("apptSummary", formatDuration(totalMin), toBanglaDigits(totalAmount))}
        </p>

        {/* ---- day ---- */}
        <section>
          <Label icon={<CalendarDays className="h-3.5 w-3.5" />} text={t("apptPickDay")} />
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
                    "min-h-14 shrink-0 rounded-xl border px-3 py-1.5 text-center transition-colors",
                    on
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line bg-card text-muted hover:border-accent/40",
                  )}
                >
                  <span className="block text-[10px] font-medium opacity-80">
                    {en
                      ? d.toLocaleDateString("en-US", { weekday: "short" })
                      : WEEKDAY_BN[d.getDay()]}
                  </span>
                  <span className="block font-number text-sm font-bold">
                    {formatBanglaDate(d)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ---- who (optional) ---- */}
        {staff.length > 1 && (
          <section>
            <Label icon={<Users className="h-3.5 w-3.5" />} text={t("apptPickStaff")} />
            <div className="flex flex-wrap gap-1.5">
              <Chip
                on={staffId === null}
                onClick={() => {
                  setStaffId(null);
                  setChosen(null);
                }}
                label={t("apptAnyStaff")}
              />
              {staff.map((chair) => (
                <Chip
                  key={chair.id}
                  on={staffId === chair.id}
                  onClick={() => {
                    setStaffId(chair.id);
                    setChosen(null);
                  }}
                  label={chair.staff_name || chair.label}
                  avatarUrl={chair.staff_avatar_url}
                />
              ))}
            </div>
          </section>
        )}

        {/* ---- time ---- */}
        <section>
          <Label icon={<Clock3 className="h-3.5 w-3.5" />} text={t("apptPickTime")} />
          {isPending ? (
            <div className="grid min-h-24 place-items-center">
              <Spinner className="h-5 w-5 text-muted" />
            </div>
          ) : isError ? (
            <p className="py-6 text-center text-sm text-live">{t("apptSlotsFailed")}</p>
          ) : byTime.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[13px] text-muted">
              {t("apptNoSlots")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {byTime.map(([startsAt, options]) => {
                const on = chosen?.startsAt === startsAt;
                return (
                  <button
                    key={startsAt}
                    type="button"
                    onClick={() => setChosen(options[0])}
                    aria-pressed={on}
                    className={cn(
                      "min-h-11 rounded-xl border px-2 py-1.5 font-number text-[13px] font-semibold transition-colors",
                      on
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line bg-card text-ink hover:border-accent/40",
                    )}
                  >
                    {formatBanglaTime(new Date(startsAt))}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {book.isError && (
          <p className="text-sm text-live">
            {book.error instanceof Error ? book.error.message : t("apptBookFailed")}
          </p>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={!chosen}
          loading={book.isPending}
          onClick={confirm}
        >
          <Check className="h-4 w-4" />
          {chosen
            ? t("apptConfirmAt", formatBanglaTime(new Date(chosen.startsAt)), chosen.staffName)
            : t("apptPickTimeFirst")}
        </Button>
      </div>
    </BottomSheet>
  );
}

const WEEKDAY_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

function Label({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
      {icon}
      {text}
    </p>
  );
}

function Chip({
  on,
  onClick,
  label,
  avatarUrl,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  avatarUrl?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors",
        on
          ? "border-accent bg-accent text-accent-ink"
          : "border-line bg-card text-muted hover:border-accent/40",
      )}
    >
      {avatarUrl !== undefined && (
        <AvatarChip label={label} avatarUrl={avatarUrl} shape="circle" size={18} />
      )}
      {label}
    </button>
  );
}
