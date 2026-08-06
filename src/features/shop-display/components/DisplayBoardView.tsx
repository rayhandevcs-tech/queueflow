"use client";

import { Coffee, MonitorOff, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { LiveDot } from "@/components/ui/LiveDot";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { toBanglaDigits } from "@/lib/format-wait";
import { useNowMs } from "@/hooks/use-now";
import { breakMinutesLeft } from "@/lib/shop-availability";
import { useLanguage, useT } from "@/lib/i18n";
import { useDisplayBoard, useScreenWakeLock } from "../hooks/use-display-board";
import { shopDisplayDict } from "../lib/i18n";
import type { DisplayLane } from "../api/display.api";

/**
 * The screen taped to the counter.
 *
 * Read from three metres away by someone standing in the shop, so everything
 * is oversized and there is nothing to tap — no nav, no auth, no interaction
 * at all. The point isn't only to inform the people already waiting: it is the
 * cheapest advertising the shop has, because every one of them asks what it is.
 *
 * It was built dark, on the theory that a wall screen wants contrast. That was
 * wrong for the one job it does best: it is the only piece of the product a
 * stranger sees before they know the product exists, and it looked like a
 * different app. It now uses the same paper, cards and hairlines as everything
 * else — the size does the reading-from-a-distance work, not the darkness.
 */
export function DisplayBoardView({ shopId }: { shopId: string }) {
  const { data: board, isPending, isError } = useDisplayBoard(shopId);
  const { language } = useLanguage();
  const t = useT(shopDisplayDict);
  const nowMs = useNowMs(30_000);
  useScreenWakeLock(true);

  const num = (n: number) => (language === "en" ? String(n) : toBanglaDigits(n));

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper">
        <Spinner className="h-10 w-10 text-muted" />
      </div>
    );
  }

  if (isError || !board) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-6 text-center">
        <div>
          <MonitorOff className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-4 font-display text-2xl font-bold text-ink">
            {isError ? t("connectionLost") : t("notFoundTitle")}
          </p>
          {!isError && <p className="mt-2 text-muted">{t("notFoundBody")}</p>}
        </div>
      </div>
    );
  }

  const breakLeft = breakMinutesLeft(board.shop, nowMs);
  const notice = !board.shop.is_open
    ? t("shopClosed")
    : breakLeft > 0
      ? board.shop.break_reason
        ? `${board.shop.break_reason} — ${t("onBreak", breakLeft)}`
        : t("onBreak", breakLeft)
      : !board.shop.accepting_new
        ? t("notAccepting")
        : null;

  return (
    <div className="flex min-h-dvh flex-col bg-paper px-5 py-6 text-ink sm:px-8 lg:px-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl lg:text-4xl">
          {board.shop.name}
        </h1>
        <span className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-muted shadow-xs sm:text-sm">
          <LiveDot />
          {t("waitingCount", board.waiting_total)}
        </span>
      </header>

      {notice && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brass/25 bg-brass-soft px-5 py-3.5 text-base font-bold text-brass sm:text-xl">
          {breakLeft > 0 ? (
            <Coffee className="h-5 w-5 shrink-0" />
          ) : (
            <WifiOff className="h-5 w-5 shrink-0" />
          )}
          {notice}
        </div>
      )}

      <div className="mt-5 grid flex-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {board.lanes.map((lane) => (
          <LaneCard key={lane.chair_id} lane={lane} num={num} />
        ))}
      </div>

      <footer className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5">
        <div>
          <p className="font-display text-xl font-extrabold sm:text-3xl">{t("ctaHeadline")}</p>
          <p className="mt-1 text-sm text-muted sm:text-lg">{t("ctaBody")}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted sm:text-sm">{t("estWait")}</p>
          <p className="font-number text-4xl font-extrabold text-accent sm:text-6xl">
            {num(board.wait_min)}
            <span className="ml-1.5 text-base font-bold sm:text-2xl">{t("minutes")}</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

function LaneCard({
  lane,
  num,
}: {
  lane: DisplayLane;
  num: (n: number) => string;
}) {
  const t = useT(shopDisplayDict);
  const busy = lane.now_serving != null;

  return (
    <section className="rounded-3xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <AvatarChip label={lane.staff_name} avatarUrl={lane.avatar_url} shape="circle" size={40} />
        <p className="min-w-0 flex-1 truncate font-display text-lg font-bold sm:text-2xl">
          {lane.staff_name}
        </p>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted sm:text-sm">{t("nowServing")}</p>
          <p
            className={cn(
              "font-number text-5xl leading-none font-extrabold sm:text-7xl",
              // "খালি" was a washed-out grey on the dark board, which had it
              // backwards: a free chair is the most useful thing a passer-by
              // can see, so it gets the good tone rather than being faded out.
              // Only one of the two ever shows in a lane, so they never clash.
              busy ? "text-accent" : "text-good",
            )}
          >
            {busy ? `#${num(lane.now_serving!)}` : t("freeNow")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted sm:text-sm">{t("nextUp")}</p>
          <p className="font-number text-2xl font-bold text-ink sm:text-4xl">
            {lane.next_up != null ? `#${num(lane.next_up)}` : t("noneWaiting")}
          </p>
        </div>
      </div>
    </section>
  );
}
