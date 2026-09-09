import { getStoredLanguage } from "@/lib/i18n";
import { toBanglaDigits } from "@/lib/format-wait";

/**
 * Service durations, in one unit.
 *
 * **Minutes are the representation everywhere** — `services.default_duration_min`,
 * `chair_service_stats.rolling_avg_duration_min`, the queue's backlog maths and
 * `estimate_duration_on_chair()` all count in whole minutes, and the learning
 * trigger in `20260904` compares them. Hours are an *input and display* idea
 * only: a bridal package is entered as "3 hours 30 minutes" and stored as 210.
 *
 * Splitting the stored unit into two columns would have meant touching the
 * queue engine, which is exactly the kind of change a parlour feature has no
 * business making.
 */

/** Ceiling for a single service — mirrors the schema's `max(480)`, i.e. 8h. */
export const MAX_DURATION_MIN = 480;

export interface HoursMinutes {
  hours: number;
  minutes: number;
}

/** 150 → { hours: 2, minutes: 30 }. Negative and fractional input is clamped. */
export function splitDuration(totalMin: number): HoursMinutes {
  const safe = Math.max(0, Math.round(Number.isFinite(totalMin) ? totalMin : 0));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

/**
 * { hours: 2, minutes: 30 } → 150.
 *
 * Minutes over 59 carry into hours rather than being rejected: someone typing
 * "90" in the minutes box means an hour and a half, and refusing that would be
 * pedantry. The result is clamped to the schema's ceiling so the form can
 * never submit a value the database would refuse.
 */
export function joinDuration({ hours, minutes }: HoursMinutes): number {
  const h = Math.max(0, Math.floor(Number.isFinite(hours) ? hours : 0));
  const m = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0));
  return Math.min(h * 60 + m, MAX_DURATION_MIN);
}

/**
 * "৩০ মিনিট", "১ ঘণ্টা", "২ ঘণ্টা ৩০ মিনিট" / "30 min", "1 hr", "2 hr 30 min".
 *
 * Language-aware the same way `formatBanglaDate` is — reads the stored
 * language itself, so callers don't each have to thread it through.
 */
export function formatDuration(totalMin: number): string {
  const en = getStoredLanguage() === "en";
  const { hours, minutes } = splitDuration(totalMin);
  const n = (value: number) => (en ? String(value) : toBanglaDigits(value));

  const hourWord = en ? "hr" : "ঘণ্টা";
  const minuteWord = en ? "min" : "মিনিট";

  if (hours === 0) return `${n(minutes)} ${minuteWord}`;
  if (minutes === 0) return `${n(hours)} ${hourWord}`;
  return `${n(hours)} ${hourWord} ${n(minutes)} ${minuteWord}`;
}
