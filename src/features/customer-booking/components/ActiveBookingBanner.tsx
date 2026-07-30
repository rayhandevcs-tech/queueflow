"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LiveDot } from "@/components/ui/LiveDot";
import { useT } from "@/lib/i18n";
import { useMyActiveSerial } from "../hooks/use-my-serial";
import { useShopDetail } from "../hooks/use-shop-detail";
import { useCountdownMinutes } from "../hooks/use-countdown-minutes";
import { customerBookingDict } from "../lib/i18n";

/** Home-screen banner for a customer's current booking, anywhere in the app. */
export function ActiveBookingBanner() {
  const { data: serial } = useMyActiveSerial();
  const shopQuery = useShopDetail(serial?.shop_id ?? "");
  const etaMin = useCountdownMinutes(
    serial?.status === "WAITING" ? serial.estimated_start_at : null,
  );
  const t = useT(customerBookingDict);

  if (!serial) return null;

  const waitLabel =
    serial.status === "IN_PROGRESS" ? t("nowInProgress") : t("minutesUnit", etaMin ?? "…");

  return (
    <Link
      href="/my-serial"
      className="mb-4.5 flex animate-pop items-center gap-3.5 rounded-[20px] bg-accent px-4.5 py-4 text-accent-ink"
    >
      <div className="grid h-11.5 w-11.5 shrink-0 place-items-center rounded-2xl bg-white/10">
        <LiveDot />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs opacity-60">
          {t("yourSerialRunning", shopQuery.data?.name ?? "…")}
        </p>
        <p className="font-display text-base font-bold">
          {t("serialEta", serial.position, waitLabel)}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 opacity-50" />
    </Link>
  );
}
