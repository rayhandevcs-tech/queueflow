"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Armchair,
  CalendarClock,
  CalendarDays,
  Check,
  Scissors,
  Users,
} from "lucide-react";
import type { Shop } from "@/types";
import { keys } from "@/lib/query/keys";
import { useLanguage, useT } from "@/lib/i18n";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { getActiveServicesForSummary, getChairsForSummary } from "../api/parlour-summary.api";
import { useTodayAppointments } from "../hooks/use-today-appointments";
import { providerAppointmentsDict } from "../lib/i18n";
import { AppointmentBoard } from "./AppointmentBoard";

/**
 * The home screen a beauty parlour lands on.
 *
 * A parlour books time slots, not a live line (decision 23), so opening the
 * queue board here would describe a product it doesn't run. The queue is not
 * reachable from this screen at all — decision 37, the owner's call: a
 * parlour is an appointment business, so the transition does not get a
 * second, contradictory screen.
 *
 * Until the booking engine lands (Sprint 4–5) this screen is read-only. It
 * says so rather than implying otherwise, which is why the board carries its
 * "customers can't book yet" note instead of a bare empty state.
 */
export function ParlourDashboard({ shop }: { shop: Shop }) {
  const { language } = useLanguage();
  const t = useT(providerAppointmentsDict);
  const en = language === "en";

  // One day object for the whole screen: two `new Date()` calls could land on
  // either side of midnight and quietly draw two different days.
  const today = useMemo(() => new Date(), []);

  const { data: chairs, isPending: chairsPending } = useQuery({
    queryKey: keys.chairs.byShop(shop.id),
    queryFn: () => getChairsForSummary(shop.id),
  });
  const { data: services } = useQuery({
    queryKey: keys.services.byShop(shop.id),
    queryFn: () => getActiveServicesForSummary(shop.id),
  });
  const { data: appointments } = useTodayAppointments(shop.id, today);

  const activeSeatCount = chairs?.filter((c) => c.is_active).length ?? 0;
  const serviceCount = services?.length ?? 0;
  const num = (n: number) => (en ? String(n) : toBanglaDigits(n));

  const dateLabel = en
    ? today.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
    : formatBanglaDate(today);

  const coming = [
    { icon: CalendarDays, label: t("comingSlotPicker") },
    { icon: CalendarClock, label: t("comingCalendar") },
    { icon: Users, label: t("comingHours") },
    { icon: Check, label: t("comingReminder") },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("greeting")}</h1>
        <p className="mt-1 text-sm text-muted">{t("todayDate", dateLabel)}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile
          value={num(appointments?.length ?? 0)}
          label={t("appointmentsTile")}
          icon={<CalendarClock className="h-4 w-4" />}
          accentValue={(appointments?.length ?? 0) > 0 ? "accent" : "ink"}
        />
        <StatTile
          value={num(activeSeatCount)}
          label={t("activeSeatsTile")}
          icon={<Armchair className="h-4 w-4" />}
          accentValue={activeSeatCount > 0 ? "good" : "ink"}
        />
        <StatTile
          value={num(serviceCount)}
          label={t("servicesTile")}
          icon={<Scissors className="h-4 w-4" />}
        />
      </div>

      <AppointmentBoard
        shop={shop}
        chairs={chairs}
        chairsPending={chairsPending}
        day={today}
      />

      <Card tone="accent" className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-accent shadow-xs">
            <CalendarClock className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-ink">{t("buildingTitle")}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t("buildingBody")}</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2.5 border-t border-accent/15 pt-4">
          {coming.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-start gap-2.5 text-sm text-ink">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="leading-snug">{label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div>
        <p className="mb-2.5 text-[13px] font-semibold text-muted">{t("setUpTitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetUpLink
            href="/chairs"
            icon={<Armchair className="h-4.5 w-4.5" />}
            title={t("setUpSeats")}
            hint={t("setUpSeatsHint")}
          />
          <SetUpLink
            href="/services"
            icon={<Scissors className="h-4.5 w-4.5" />}
            title={t("setUpServices")}
            hint={t("setUpServicesHint")}
          />
        </div>
      </div>
    </div>
  );
}

function SetUpLink({
  href,
  icon,
  title,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <Link href={href} className="block">
      <Card hover className="flex h-full items-start gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-muted">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">{hint}</p>
        </div>
      </Card>
    </Link>
  );
}
