"use client";

import Link from "next/link";
import { Loader2, Scissors, Ticket, Users } from "lucide-react";
import { parseServicesSnapshot } from "@/types";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useMyActiveSerial, useShopQueuePublic } from "../hooks/use-my-serial";
import { useShopDetail } from "../hooks/use-shop-detail";
import { useCancelMySerial } from "../hooks/use-booking-mutations";
import { useCountdownMinutes } from "../hooks/use-countdown-minutes";

export function LiveTrackingView() {
  const { data: serial, isPending } = useMyActiveSerial();
  const cancel = useCancelMySerial();
  const shopQuery = useShopDetail(serial?.shop_id ?? "");
  const queuePublic = useShopQueuePublic(serial?.shop_id);
  const etaMin = useCountdownMinutes(
    serial?.status === "WAITING" ? serial.estimated_start_at : null,
  );

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
        <p className="text-sm text-ink">You don&apos;t have an active serial.</p>
        <Link href="/explore">
          <Button size="lg">Find a shop</Button>
        </Link>
      </div>
    );
  }

  const shop = shopQuery.data;
  const services = parseServicesSnapshot(serial.services_snapshot);
  const inProgress = serial.status === "IN_PROGRESS";

  const aheadCount = (queuePublic.data ?? []).filter(
    (r) =>
      r.id !== serial.id &&
      r.chair_id === serial.chair_id &&
      (r.status === "IN_PROGRESS" || r.position < serial.position),
  ).length;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <p className="text-sm text-muted">{shop?.name ?? "Shop"}</p>
        <h1 className="font-display text-xl font-bold">Your Live Serial</h1>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-ink p-7 text-center shadow-lg">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-brass/15 blur-3xl" />

        {inProgress ? (
          <div className="relative space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-good/20 text-good">
              <Scissors className="h-7 w-7 animate-pulse" />
            </div>
            <p className="text-xs uppercase tracking-wide text-accent-ink/60">
              Your service is in progress
            </p>
            <p className="font-display text-3xl font-bold text-accent-ink">
              In progress…
            </p>
          </div>
        ) : (
          <div className="relative space-y-3">
            <p className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-accent-ink/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Estimated time until your turn
            </p>
            <p className="font-display text-5xl font-bold tabular-nums text-accent-ink">
              {etaMin !== null ? etaMin : "—"}
              <span className="ml-1.5 text-lg font-semibold text-accent-ink/60">min</span>
            </p>
            <div className="inline-flex items-center gap-3 rounded-full bg-accent-ink/10 px-4 py-1.5 text-sm text-accent-ink">
              <span className="font-semibold">Serial #{serial.position}</span>
              <span className="h-3 w-px bg-accent-ink/25" />
              <span className="flex items-center gap-1 text-accent-ink/75">
                <Users className="h-3.5 w-3.5" />
                {aheadCount} ahead
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Services
        </p>
        <ul className="space-y-1.5 text-sm text-ink">
          {services.map((s) => (
            <li key={s.service_id} className="flex justify-between">
              <span>{s.name}</span>
              <span className="font-medium">৳{s.rate}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-bold text-ink">
          <span>Total</span>
          <span>৳{serial.total_amount}</span>
        </div>
      </div>

      {serial.status === "WAITING" && (
        <Button
          variant="danger"
          size="lg"
          onClick={() => cancel.mutate(serial.id)}
          loading={cancel.isPending}
          className="w-full"
        >
          {cancel.isPending ? "Cancelling…" : "Cancel serial"}
        </Button>
      )}
    </div>
  );
}
