"use client";

import Link from "next/link";
import { CalendarClock, CalendarOff, Clock3, Users } from "lucide-react";
import type { Chair, Shop } from "@/types";
import { cn } from "@/lib/utils";
import { useLanguage, useT } from "@/lib/i18n";
import { useTerms } from "@/lib/business-terms";
import { parseWeeklyHours } from "@/lib/weekly-hours";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { useNow } from "../hooks/use-now";
import { useTodayAppointments } from "../hooks/use-today-appointments";
import {
  SLOT_MINUTES,
  blockPosition,
  dayWindow,
  groupByStaff,
  nowLinePct,
  timeRows,
} from "../lib/schedule";
import { providerAppointmentsDict } from "../lib/i18n";
import { AppointmentBlock } from "./AppointmentBlock";

/** Height of one 30-minute row. Big enough to tap a block on a phone. */
const SLOT_PX = 44;
/** Narrow enough that two beauticians fit on a 320px screen with the gutter. */
const COLUMN_MIN_PX = 132;
const GUTTER_PX = 52;

/**
 * The parlour's day: beauticians across, time down.
 *
 * The columns and the time axis are drawn from data that already exists —
 * `chairs` and the shop's `weekly_hours` — so this is a real screen today,
 * not a mock. The only thing missing is the bookings, which arrive in
 * Sprint 4 through `useTodayAppointments` without this file changing.
 *
 * One grid for both breakpoints rather than a phone layout and a desktop
 * layout: a day view whose columns are people is the same idea at every
 * width, so a small screen scrolls it sideways with the time gutter pinned —
 * the way calendar apps have settled on — instead of becoming a second
 * screen that then has to be kept in sync with this one.
 */
export function AppointmentBoard({
  shop,
  chairs,
  chairsPending,
  day,
}: {
  shop: Shop;
  chairs: Chair[] | undefined;
  chairsPending: boolean;
  day: Date;
}) {
  const t = useT(providerAppointmentsDict);
  const { language } = useLanguage();
  const tt = useTerms(shop.business_type, language);
  const { data: appointments, isPending, isError } = useTodayAppointments(shop.id, day);

  // null until mounted — see `useNow`. The "now" line appears after the first
  // client commit rather than being rendered on the server at a stale minute.
  const now = useNow();

  const weeklyHours = parseWeeklyHours(shop.weekly_hours);
  const openWindow = dayWindow(weeklyHours, day);
  // Inactive seats stay as columns, dimmed. Dropping them would make a shop
  // that paused everyone look like a shop with no staff at all.
  const staff = chairs ?? [];
  const byStaff = groupByStaff(appointments ?? []);
  const count = appointments?.length ?? 0;

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <p className="font-display text-base font-bold text-ink">{t("boardTitle")}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          {formatBanglaDate(day)}
          {openWindow && (
            <>
              <span aria-hidden>·</span>
              <span className="font-number">
                {t("boardHours", clockLabel(openWindow.openMin), clockLabel(openWindow.closeMin))}
              </span>
            </>
          )}
        </p>
      </div>
      <StatusPill
        tone={count > 0 ? "accent" : "neutral"}
        dot={false}
        label={`${toBanglaDigits(count)} · ${t("appointmentsTile")}`}
      />
    </header>
  );

  function body() {
    if (chairsPending || isPending) {
      return (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="h-6 w-6 text-muted" />
        </div>
      );
    }

    if (isError) {
      return <p className="px-4 py-10 text-center text-sm text-live">{t("boardLoadFailed")}</p>;
    }

    if (staff.length === 0) {
      return (
        <EmptyState
          className="border-0 shadow-none"
          icon={<Users className="h-6 w-6" />}
          title={t("boardNoStaffTitle", tt("staff"))}
          description={t("boardNoStaffDesc")}
          action={
            <Link href="/chairs" className="text-sm font-semibold text-accent hover:underline">
              {t("boardNoStaffCta")}
            </Link>
          }
        />
      );
    }

    if (!openWindow) {
      // Two different reasons with two different fixes: shut today needs no
      // action at all, unset hours is a setup step and gets a link.
      const closedToday = weeklyHours !== null;
      return (
        <EmptyState
          className="border-0 shadow-none"
          icon={<CalendarOff className="h-6 w-6" />}
          title={closedToday ? t("boardClosedTitle") : t("boardNoHoursTitle")}
          description={closedToday ? t("boardClosedDesc") : t("boardNoHoursDesc")}
          action={
            closedToday ? undefined : (
              <Link href="/settings" className="text-sm font-semibold text-accent hover:underline">
                {t("boardHoursCta")}
              </Link>
            )
          }
        />
      );
    }

    const span = openWindow.closeMin - openWindow.openMin;
    const columnHeightPx = (span / SLOT_MINUTES) * SLOT_PX;
    const nowPct = now ? nowLinePct(now, openWindow, day) : null;
    /** Position by clock time, not by row index — the last row is a short one
     *  whenever the closing time doesn't land on a slot boundary. */
    const topPctOf = (minutes: number) => ((minutes - openWindow.openMin) / span) * 100;

    return (
      <div className="overflow-x-auto">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `${GUTTER_PX}px repeat(${staff.length}, minmax(${COLUMN_MIN_PX}px, 1fr))`,
          }}
        >
          {/* --- header row: the gutter's blank corner, then one per person --- */}
          <div className="sticky left-0 z-20 border-b border-line bg-card" />
          {staff.map((chair) => (
            <div
              key={chair.id}
              className={cn(
                "flex min-w-0 items-center gap-2 border-b border-l border-line bg-card px-2 py-2",
                !chair.is_active && "opacity-55",
              )}
            >
              <AvatarChip
                label={chair.staff_name || chair.label}
                avatarUrl={chair.staff_avatar_url}
                shape="circle"
                size={26}
              />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold text-ink">
                  {chair.staff_name || chair.label}
                </p>
                <p className="truncate text-[10px] text-muted">{chair.label}</p>
              </div>
            </div>
          ))}

          {/* --- time gutter, pinned while the columns scroll sideways --- */}
          <div className="sticky left-0 z-10 bg-card" style={{ height: columnHeightPx }}>
            <div className="relative h-full">
              {timeRows(openWindow).map((minutes) =>
                minutes % 60 === 0 ? (
                  <span
                    key={minutes}
                    className="absolute right-1.5 -translate-y-1/2 font-number text-[10px] text-muted"
                    style={{ top: `${topPctOf(minutes)}%` }}
                  >
                    {clockLabel(minutes)}
                  </span>
                ) : null,
              )}
              {nowPct !== null && (
                <span
                  className="absolute right-1 -translate-y-1/2 rounded-full bg-accent px-1 py-px text-[9px] font-bold text-accent-ink"
                  style={{ top: `${nowPct}%` }}
                >
                  {t("nowLabel")}
                </span>
              )}
            </div>
          </div>

          {/* --- one column per person --- */}
          {staff.map((chair) => (
            <div
              key={chair.id}
              className={cn("relative border-l border-line", !chair.is_active && "bg-soft/50")}
              style={{
                height: columnHeightPx,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0 1px, transparent 1px ${SLOT_PX}px)`,
              }}
            >
              {(byStaff.get(chair.id) ?? []).map((appointment) => {
                const position = blockPosition(appointment, openWindow, day);
                if (!position) return null;
                return (
                  <AppointmentBlock
                    key={appointment.id}
                    appointment={appointment}
                    position={position}
                    columnHeightPx={columnHeightPx}
                  />
                );
              })}

              {nowPct !== null && (
                <span
                  className="pointer-events-none absolute inset-x-0 z-10 h-px bg-accent"
                  style={{ top: `${nowPct}%` }}
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>

        {count === 0 && <EmptyDayNote />}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      {header}
      {body()}
    </Card>
  );
}

/**
 * Why the grid is empty. Without this an owner would sit watching a board for
 * bookings that cannot arrive yet, which is the worst kind of empty state.
 */
function EmptyDayNote() {
  const t = useT(providerAppointmentsDict);
  return (
    <div className="flex flex-col items-center gap-1 border-t border-line px-4 py-4 text-center">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Clock3 className="h-4 w-4 text-muted" />
        {t("boardEmptyDay")}
      </p>
      <p className="max-w-md text-[12px] leading-relaxed text-muted">{t("boardNotLiveNote")}</p>
    </div>
  );
}

function twoDigits(n: number): string {
  return String(n)
    .padStart(2, "0")
    .split("")
    .map((d) => toBanglaDigits(Number(d)))
    .join("");
}

/** "১০:০০" / "10:00" — the gutter stays on the 24h clock to stay narrow. */
function clockLabel(minutes: number): string {
  return `${toBanglaDigits(Math.floor(minutes / 60))}:${twoDigits(minutes % 60)}`;
}
