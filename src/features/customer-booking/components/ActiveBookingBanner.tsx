"use client";

import Link from "next/link";
import { BellRing, ChevronRight, MapPinCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveDot } from "@/components/ui/LiveDot";
import { useT } from "@/lib/i18n";
import { useMyActiveSerials } from "../hooks/use-my-serial";
import { useShopDetail } from "../hooks/use-shop-detail";
import { useCountdownMinutes } from "../hooks/use-countdown-minutes";
import { customerBookingDict } from "../lib/i18n";

/**
 * The customer's current booking, on every screen.
 *
 * This is the banner someone glances at rather than opening the app for, so
 * it carries the two states that need acting on immediately — the shop has
 * called you, or you've told them you're there — instead of only the ETA.
 */
export function ActiveBookingBanner() {
  const { data: rows } = useMyActiveSerials();
  const serial = rows?.[0] ?? null;
  const party = rows ?? [];
  const shopQuery = useShopDetail(serial?.shop_id ?? "");
  const etaMin = useCountdownMinutes(
    serial?.status === "WAITING" ? serial.estimated_start_at : null,
  );
  const t = useT(customerBookingDict);

  if (!serial) return null;

  const called = serial.status === "WAITING" && !!serial.called_at;
  const arrived = serial.status === "WAITING" && !!serial.arrived_at && !called;

  const waitLabel =
    serial.status === "IN_PROGRESS" ? t("nowInProgress") : t("minutesUnit", etaMin ?? "…");

  return (
    <Link
      href="/my-serial"
      className={cn(
        "mb-4.5 flex animate-pop items-center gap-3.5 rounded-[20px] px-4.5 py-4",
        // Being called is urgent enough to break the usual accent colour.
        called ? "bg-live text-white" : "bg-accent text-accent-ink",
      )}
    >
      <div className="grid h-11.5 w-11.5 shrink-0 place-items-center rounded-2xl bg-white/15">
        {called ? (
          <BellRing className="h-5 w-5" />
        ) : arrived ? (
          <MapPinCheck className="h-5 w-5" />
        ) : (
          <LiveDot />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-xs opacity-70">
          {party.length > 1 && <Users className="h-3 w-3 shrink-0" />}
          {party.length > 1
            ? t("partyAtShop", party.length, shopQuery.data?.name ?? "…")
            : t("yourSerialRunning", shopQuery.data?.name ?? "…")}
        </p>
        <p className="font-display text-base font-bold">
          {called
            ? t("calledNotice")
            : t("serialEta", serial.position, waitLabel)}
        </p>
        {arrived && <p className="text-[11px] opacity-70">{t("arrivedBadge")}</p>}
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 opacity-50" />
    </Link>
  );
}
