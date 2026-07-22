"use client";

import Link from "next/link";
import { ChevronLeft, Loader2, Ticket } from "lucide-react";
import { parseServicesSnapshot } from "@/types";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { LiveDot } from "@/components/ui/LiveDot";
import { CountdownRing } from "@/components/ui/CountdownRing";
import { useMyActiveSerial, useShopQueuePublic } from "../hooks/use-my-serial";
import { useShopDetail } from "../hooks/use-shop-detail";
import { useCancelMySerial } from "../hooks/use-booking-mutations";
import { useNowMs } from "@/hooks/use-now";
import { fmtMMSS, fmtWait } from "@/lib/format-wait";

export function LiveTrackingView() {
  const { data: serial, isPending } = useMyActiveSerial();
  const cancel = useCancelMySerial();
  const shopQuery = useShopDetail(serial?.shop_id ?? "");
  const queuePublic = useShopQueuePublic(serial?.shop_id);
  const nowMs = useNowMs(1000);

  if (isPending) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!serial) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-soft text-muted">
          <Ticket className="h-7 w-7" />
        </div>
        <p className="text-sm text-ink">তোমার এখন কোনো সক্রিয় সিরিয়াল নেই।</p>
        <Link href="/explore">
          <Button size="lg">দোকান খুঁজো</Button>
        </Link>
      </div>
    );
  }

  const shop = shopQuery.data;
  const services = parseServicesSnapshot(serial.services_snapshot);
  const myInProgress = serial.status === "IN_PROGRESS";

  const chairRows = (queuePublic.data ?? []).filter((r) => r.chair_id === serial.chair_id);
  const currentJob = chairRows.find((r) => r.status === "IN_PROGRESS");

  // Center of the ring: my own wait (WAITING) or my own remaining service (IN_PROGRESS).
  let centerSec: number;
  if (myInProgress) {
    const startedMs = serial.started_at ? new Date(serial.started_at).getTime() : nowMs;
    centerSec = Math.max(0, (startedMs + serial.estimated_duration_min * 60_000 - nowMs) / 1000);
  } else {
    const startAtMs = serial.estimated_start_at ? new Date(serial.estimated_start_at).getTime() : nowMs;
    centerSec = Math.max(0, (startAtMs - nowMs) / 1000);
  }
  const centerWait = fmtWait(centerSec);

  // Ring progress: while I wait, pulse with whoever's chair-job is running now;
  // once it's my turn, the ring is literally my own remaining service.
  let ringProgress = 1;
  if (myInProgress) {
    ringProgress = centerSec / (serial.estimated_duration_min * 60);
  } else if (currentJob?.estimated_start_at) {
    const finishMs =
      new Date(currentJob.estimated_start_at).getTime() +
      currentJob.estimated_duration_min * 60_000;
    const totalSec = currentJob.estimated_duration_min * 60;
    ringProgress = totalSec > 0 ? Math.max(0, (finishMs - nowMs) / 1000) / totalSec : 1;
  }

  // Everyone on my chair, ahead of me — PII-free, so rows are labeled by
  // booking type + timing rather than name (queue_public carries no name).
  const aheadRows = chairRows
    .filter((r) => r.id !== serial.id && (r.status === "IN_PROGRESS" || r.position < serial.position))
    .sort((a, b) => {
      if (a.status === "IN_PROGRESS") return -1;
      if (b.status === "IN_PROGRESS") return 1;
      return a.position - b.position;
    });

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-1 flex items-center gap-2.5">
        <Link
          href="/explore"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-line bg-soft text-ink"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="font-display text-lg leading-none font-bold text-ink">
            {shop?.name ?? "…"}
          </p>
          <p className="mt-1 text-xs text-muted">তোমার লাইভ সিরিয়াল</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-live">
          <LiveDot />
          LIVE
        </span>
      </div>

      <div className="relative mt-4.5 overflow-hidden rounded-[26px] bg-ink px-5.5 py-7 text-center">
        <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -bottom-20 h-64 w-64 rounded-full bg-brass/15 blur-3xl" />

        <p className="relative text-xs tracking-wide text-accent-ink/55">
          {myInProgress ? "তোমার সার্ভিস চলছে" : "তোমার সিরিয়াল আসতে বাকি"}
        </p>

        <div className="relative mx-auto mt-3.5 mb-1.5">
          <CountdownRing progress={ringProgress} className="mx-auto">
            <div className="flex flex-col items-center">
              <span className="font-number text-[42px] leading-none font-bold tracking-tight text-accent-ink">
                {centerWait.big}
              </span>
              <span className="mt-1 text-xs text-accent-ink/50">{centerWait.unit}</span>
            </div>
          </CountdownRing>
        </div>

        <div className="relative inline-flex items-center gap-3 rounded-full bg-accent-ink/10 px-4 py-2 text-sm text-accent-ink">
          <span className="opacity-60">তোমার সিরিয়াল</span>
          <span className="font-display text-xl font-extrabold text-live">
            #{serial.position}
          </span>
        </div>
      </div>

      <p className="mt-5.5 mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
        তোমার আগে যারা ({aheadRows.length} জন)
      </p>

      <div className="flex flex-col gap-2">
        {aheadRows.map((row, i) => {
          const live = row.status === "IN_PROGRESS";
          let time: string;
          if (live) {
            const finishMs = row.estimated_start_at
              ? new Date(row.estimated_start_at).getTime() + row.estimated_duration_min * 60_000
              : nowMs;
            time = fmtMMSS((finishMs - nowMs) / 1000);
          } else {
            const startMs = row.estimated_start_at ? new Date(row.estimated_start_at).getTime() : nowMs;
            time = fmtWait((startMs - nowMs) / 1000).label;
          }
          return (
            <div
              key={row.id}
              className="flex items-center gap-3 rounded-[14px] border border-line p-2.75"
              style={{ background: live ? "var(--color-live-soft)" : "var(--color-card)" }}
            >
              <div
                className="grid h-7.5 w-7.5 shrink-0 place-items-center rounded-[10px] font-number text-sm font-bold"
                style={{
                  background: live ? "var(--color-live)" : "var(--color-soft)",
                  color: live ? "#fff" : "var(--color-muted)",
                }}
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">
                  {row.is_walk_in ? "ওয়াক-ইন কাস্টমার" : "অনলাইন বুকিং"}
                </p>
                <p className="text-[11px] text-muted">
                  ~{row.estimated_duration_min} মিনিটের সার্ভিস
                </p>
              </div>
              <div className="text-right">
                <p
                  className="font-number text-[13px] font-semibold"
                  style={{ color: live ? "var(--color-live)" : "var(--color-ink)" }}
                >
                  {time}
                </p>
                <p className="text-[10px] text-muted">{live ? "চলছে" : "শুরু হবে"}</p>
              </div>
            </div>
          );
        })}

        <div className="flex items-center gap-3 rounded-[14px] bg-accent p-3.25 text-accent-ink">
          <div className="grid h-7.5 w-7.5 shrink-0 place-items-center rounded-[10px] bg-white/20 font-number text-sm font-bold">
            {serial.position}
          </div>
          <div className="flex-1 text-sm font-bold">তুমি (You)</div>
          <div className="font-number text-[13px] font-semibold">
            {myInProgress ? "চলছে" : centerWait.label}
          </div>
        </div>
      </div>

      {services.length > 0 && (
        <div className="mt-4.5 rounded-2xl border border-line bg-card p-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">সার্ভিস</p>
          <ul className="space-y-1.5 text-sm text-ink">
            {services.map((s) => (
              <li key={s.service_id} className="flex justify-between">
                <span>{s.name}</span>
                <span className="font-number font-medium">৳{s.rate}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-bold text-ink">
            <span>মোট</span>
            <span className="font-number">৳{serial.total_amount}</span>
          </div>
        </div>
      )}

      <Link
        href="/profile"
        className="mt-5 block w-full rounded-[14px] border p-3.25 text-center text-sm font-semibold text-ink"
        style={{ borderWidth: 1.5, borderColor: "var(--color-line)", background: "var(--color-card)" }}
      >
        কাজ শেষ? রিভিউ দাও ★
      </Link>

      {serial.status === "WAITING" && (
        <button
          type="button"
          onClick={() => cancel.mutate(serial.id)}
          disabled={cancel.isPending}
          className="mt-3 w-full py-2 text-center text-sm font-medium text-live disabled:opacity-50"
        >
          {cancel.isPending ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> ক্যানসেল হচ্ছে…
            </span>
          ) : (
            "সিরিয়াল ক্যানসেল করো"
          )}
        </button>
      )}
    </div>
  );
}
