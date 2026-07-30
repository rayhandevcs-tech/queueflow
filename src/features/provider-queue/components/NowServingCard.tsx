"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { parseServicesSnapshot, type Serial } from "@/types";
import { CountdownRing } from "@/components/ui/CountdownRing";
import { LiveDot } from "@/components/ui/LiveDot";
import { useNowMs } from "@/hooks/use-now";
import { fmtMMSS, formatMoney } from "@/lib/format-wait";
import { UiDbError } from "@/lib/supabase/db-errors";
import type { useSerialActions } from "../hooks/use-serial-actions";

export function NowServingCard({
  serial,
  actions,
}: {
  serial: Serial;
  actions: ReturnType<typeof useSerialActions>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const nowMs = useNowMs(1000);
  const services = parseServicesSnapshot(serial.services_snapshot);

  const startedMs = serial.started_at ? new Date(serial.started_at).getTime() : nowMs;
  const totalSec = serial.estimated_duration_min * 60;
  const remainingSec = Math.max(0, (startedMs + totalSec * 1000 - nowMs) / 1000);
  const progress = totalSec > 0 ? remainingSec / totalSec : 0;

  const surface = (err: unknown) => {
    if (err instanceof UiDbError && err.silent) return;
    setError(err instanceof Error ? err.message : "কিছু একটা ভুল হয়েছে");
  };

  return (
    <div className="relative overflow-hidden rounded-[22px] bg-accent p-5.5 text-accent-ink">
      {serial.customer_id && (
        <button
          type="button"
          title="কাস্টমারকে মেসেজ করো"
          onClick={() => router.push(`/chat/${serial.customer_id}`)}
          className="absolute top-4.5 right-11.5 text-accent-ink/30 hover:text-accent-ink/70"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        title="ক্যানসেল করো"
        disabled={actions.cancel.isPending}
        onClick={() => {
          setError(null);
          actions.cancel.mutate(serial.id, { onError: surface });
        }}
        className="absolute top-4.5 right-4.5 text-accent-ink/30 hover:text-accent-ink/70 disabled:opacity-40"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3.5 flex items-center gap-2 text-xs text-accent-ink/60">
        <LiveDot />
        এখন চলছে · সিরিয়াল #{serial.position}
      </div>

      <div className="flex items-center gap-4">
        <CountdownRing
          size={128}
          strokeWidth={10}
          progress={progress}
          className="shrink-0"
          ringClassName="stroke-accent-ink"
          trackClassName="stroke-accent-ink/20"
        >
          <div className="flex flex-col items-center">
            <span className="font-number text-[26px] leading-none font-bold tracking-tight">
              {fmtMMSS(remainingSec)}
            </span>
            <span className="mt-1 text-[10px] text-accent-ink/50">বাকি</span>
          </div>
        </CountdownRing>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold">{serial.customer_name || "—"}</p>
          <p className="mt-0.5 truncate text-[13px] text-accent-ink/60">
            {services.map((s) => s.name).join(" + ") || "—"}
          </p>
          <p className="mt-4 font-number text-lg font-bold">৳{formatMoney(serial.total_amount)}</p>
        </div>
      </div>

      <button
        type="button"
        disabled={actions.complete.isPending}
        onClick={() => {
          setError(null);
          actions.complete.mutate({ serialId: serial.id }, { onError: surface });
        }}
        className="mt-4.5 w-full rounded-[14px] bg-accent-ink py-3.5 font-display text-[15px] font-bold text-accent disabled:opacity-60"
      >
        {actions.complete.isPending ? "হচ্ছে…" : "✓ কাজ সম্পন্ন — পরের জন"}
      </button>

      <button
        type="button"
        disabled={actions.complete.isPending}
        onClick={() => {
          setError(null);
          actions.complete.mutate(
            { serialId: serial.id, due: { amount: serial.total_amount } },
            { onError: surface },
          );
        }}
        className="mt-2 w-full text-center text-xs font-semibold text-accent-ink/60 disabled:opacity-40"
      >
        বাকি রেখে সম্পন্ন করো (৳{formatMoney(serial.total_amount)})
      </button>

      {error && <p className="mt-2 text-xs text-accent-ink">{error}</p>}
    </div>
  );
}
