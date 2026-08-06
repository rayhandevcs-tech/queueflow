"use client";

import { useState } from "react";
import { BellRing, CalendarClock, Repeat, Store } from "lucide-react";
import type { Serial, Shop } from "@/types";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { computeHabits } from "../lib/habits";
import { useMyReminder } from "../hooks/use-retention";
import { customerProfileDict } from "../lib/i18n";

/** Whole weeks, because that's how people describe a haircut cycle. */
const WEEK_OPTIONS = [2, 3, 4, 6] as const;

/**
 * "You usually come every three weeks" — and, right underneath, the offer to
 * be reminded.
 *
 * The shop can already nudge its regulars, and however politely that's worded
 * it reads as marketing. This is the same idea pointed the other way: the
 * customer sets their own interval, from their own rhythm, so it lands as a
 * note to self. That's the whole reason it's placed under the habit line
 * rather than in settings.
 */
export function HabitsCard({
  serials,
  shopsById,
}: {
  serials: Serial[];
  shopsById: Record<string, Shop>;
}) {
  const t = useT(customerProfileDict);
  const showToast = useToast();
  const { reminder, save, remove } = useMyReminder();

  const habits = computeHabits(serials);
  const [weeks, setWeeks] = useState<number>(() =>
    reminder ? Math.round(reminder.interval_days / 7) : 3,
  );

  // Nothing honest to say yet — a "habit" drawn from one visit is a guess.
  if (habits.visitCount < 2) return null;

  const favouriteShop = habits.favouriteShopId ? shopsById[habits.favouriteShopId] : undefined;

  const saveReminder = () => {
    save.mutate(
      { intervalDays: weeks * 7, shopId: habits.favouriteShopId },
      {
        onSuccess: () => showToast(t("reminderSavedToast", weeks)),
        onError: () => showToast(t("reminderFailedToast")),
      },
    );
  };

  return (
    <div className="rounded-[18px] border border-line bg-card p-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
        <Repeat className="h-3.5 w-3.5" />
        {t("habitsHeading")}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-muted">{t("habitCadenceLabel")}</p>
          <p className="mt-0.5 text-sm font-bold text-ink">
            {habits.avgDaysBetween !== null
              ? t("habitEveryDays", habits.avgDaysBetween)
              : t("habitUnknown")}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted">{t("habitLastVisitLabel")}</p>
          <p
            className={cn(
              "mt-0.5 text-sm font-bold",
              habits.overdue ? "text-live" : "text-ink",
            )}
          >
            {habits.daysSinceLast !== null
              ? t("habitDaysAgo", habits.daysSinceLast)
              : t("habitUnknown")}
          </p>
        </div>
      </div>

      {favouriteShop && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-muted">
          <Store className="h-3.5 w-3.5 shrink-0" />
          {t("habitFavouriteShop", favouriteShop.name, habits.visitCount)}
        </p>
      )}

      <div className="mt-3 border-t border-line pt-3">
        {reminder ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold text-good">
              <BellRing className="h-3.5 w-3.5 shrink-0" />
              {t("reminderActive", Math.round(reminder.interval_days / 7))}
            </p>
            <button
              type="button"
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => showToast(t("reminderRemovedToast")),
                })
              }
              disabled={remove.isPending}
              className="shrink-0 text-xs font-semibold text-muted hover:text-live disabled:opacity-50"
            >
              {t("reminderStopCta")}
            </button>
          </div>
        ) : (
          <>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              {t("reminderPrompt")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {WEEK_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeeks(w)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors",
                    weeks === w
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line bg-card text-muted",
                  )}
                >
                  {t("everyWeeks", w)}
                </button>
              ))}
              <Button size="sm" loading={save.isPending} onClick={saveReminder}>
                {t("reminderSetCta")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
