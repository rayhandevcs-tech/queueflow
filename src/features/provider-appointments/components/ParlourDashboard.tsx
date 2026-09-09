"use client";

import { useState } from "react";
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
import { keys } from "@/lib/query/keys";
import { useLanguage, useT } from "@/lib/i18n";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { TabBar } from "@/components/ui/TabBar";
import { getActiveServicesForSummary, getChairsForSummary } from "../api/parlour-summary.api";
import { providerAppointmentsDict } from "../lib/i18n";

/**
 * The home screen a beauty parlour lands on.
 *
 * A parlour books time slots, not a live line (decision 23), so opening the
 * queue board here would describe a product it doesn't run. What it gets
 * instead is an honest today view, the setup that carries over to
 * appointments, and — behind the second tab — the live queue it is still
 * running until the appointment engine lands.
 *
 * That second tab matters more than it looks. Any parlour registered today is
 * taking real customers through the queue right now; replacing their working
 * board with a "coming soon" panel would close their shop for them. The
 * default view changes, the working one stays reachable.
 *
 * `queueSlot` rather than an import: the board lives in provider-queue and
 * features can't import each other, so the dashboard page composes the two.
 */
export function ParlourDashboard({
  shopId,
  queueSlot,
}: {
  shopId: string;
  queueSlot?: React.ReactNode;
}) {
  const [tab, setTab] = useState<"today" | "queue">("today");
  const { language } = useLanguage();
  const t = useT(providerAppointmentsDict);
  const en = language === "en";

  const { data: chairs } = useQuery({
    queryKey: keys.chairs.byShop(shopId),
    queryFn: () => getChairsForSummary(shopId),
  });
  const { data: services } = useQuery({
    queryKey: keys.services.byShop(shopId),
    queryFn: () => getActiveServicesForSummary(shopId),
  });

  const seatCount = chairs?.length ?? 0;
  const activeSeatCount = chairs?.filter((c) => c.is_active).length ?? 0;
  const serviceCount = services?.length ?? 0;
  const num = (n: number) => (en ? String(n) : toBanglaDigits(n));

  const today = en
    ? new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
    : formatBanglaDate(new Date());

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
        <p className="mt-1 text-sm text-muted">{t("todayDate", today)}</p>
      </div>

      {/* Only worth a tab bar while the queue is still the working half. When
          appointments land this collapses back to a single screen. */}
      {queueSlot && (
        <TabBar
          tabs={[
            { id: "today", label: t("tabToday") },
            { id: "queue", label: t("tabLiveQueue") },
          ]}
          active={tab}
          onChange={(id) => setTab(id === "queue" ? "queue" : "today")}
        />
      )}

      {tab === "queue" && queueSlot ? (
        queueSlot
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              value={num(seatCount)}
              label={t("seatsTile")}
              icon={<Armchair className="h-4 w-4" />}
            />
            <StatTile
              value={num(activeSeatCount)}
              label={t("activeSeatsTile")}
              icon={<Users className="h-4 w-4" />}
              accentValue={activeSeatCount > 0 ? "good" : "ink"}
            />
            <StatTile
              value={num(serviceCount)}
              label={t("servicesTile")}
              icon={<Scissors className="h-4 w-4" />}
            />
          </div>

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

          {queueSlot && (
            <Card className="p-5">
              <p className="font-display text-base font-bold text-ink">{t("queueStillOnTitle")}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("queueStillOnBody")}</p>
              <button
                type="button"
                onClick={() => setTab("queue")}
                className="mt-3 min-h-11 text-sm font-semibold text-accent hover:underline"
              >
                {t("openQueueCta")} →
              </button>
            </Card>
          )}

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
      )}
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
