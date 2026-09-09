import { DAY_ORDER, type DayKey, type WeeklyHours } from "@/lib/weekly-hours";
import { parseHm, type DayWindow } from "./schedule";
import type { StaffWorkingHours } from "@/types";

/**
 * The week, as the database counts it.
 *
 * `weekday` in `staff_working_hours` is **isodow**: 1 = Monday … 7 = Sunday.
 * That is the one weekday numbering used across phase 6 — it lines up with
 * `weekly_hours`'s mon..sun key order, so there is never a second mapping to
 * get wrong.
 */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof ISO_WEEKDAYS)[number];

/** `Date.getDay()` is Sunday-first; isodow is Monday-first. */
export function isoDowOf(date: Date): IsoWeekday {
  return (((date.getDay() + 6) % 7) + 1) as IsoWeekday;
}

/** isodow → the `weekly_hours` key for the same day. */
export function dayKeyOfIso(weekday: IsoWeekday): DayKey {
  return DAY_ORDER[weekday - 1];
}

/** Rows for one beautician, keyed by weekday, for a form to read directly. */
export function hoursByWeekday(
  rows: readonly StaffWorkingHours[],
  chairId: string,
): Map<IsoWeekday, StaffWorkingHours> {
  const map = new Map<IsoWeekday, StaffWorkingHours>();
  for (const row of rows) {
    if (row.chair_id === chairId) map.set(row.weekday as IsoWeekday, row);
  }
  return map;
}

/**
 * What a beautician is actually bookable for on one weekday: their own hours
 * clipped to the shop's.
 *
 * `null` means nothing is bookable — the shop is shut, they don't work that
 * day, or the two windows don't overlap at all. This mirrors
 * `staff_is_available()` in `20260919`; the database remains the authority,
 * and this exists so the provider's own schedule screen can show the same
 * answer without a round trip.
 */
export function effectiveWindow(
  shopHours: WeeklyHours | null,
  staffRow: StaffWorkingHours | null | undefined,
  weekday: IsoWeekday,
): DayWindow | null {
  if (!staffRow) return null;

  const staffOpen = parseHm(staffRow.start_time?.slice(0, 5));
  const staffClose = parseHm(staffRow.end_time?.slice(0, 5));
  if (staffOpen === null || staffClose === null || staffClose <= staffOpen) return null;

  const day = shopHours?.[dayKeyOfIso(weekday)];
  // Hours the shop never set are not a constraint — the same tolerance the
  // insert trigger has, so the two can't disagree about an unconfigured shop.
  if (!day) return { openMin: staffOpen, closeMin: staffClose };
  if (day.closed) return null;

  const shopOpen = parseHm(day.open);
  const shopClose = parseHm(day.close);
  if (shopOpen === null || shopClose === null || shopClose <= shopOpen) {
    return { openMin: staffOpen, closeMin: staffClose };
  }

  const openMin = Math.max(staffOpen, shopOpen);
  const closeMin = Math.min(staffClose, shopClose);
  return closeMin > openMin ? { openMin, closeMin } : null;
}

/** True when the staff member's own hours reach beyond the shop's. */
export function isClippedByShop(
  shopHours: WeeklyHours | null,
  staffRow: StaffWorkingHours | null | undefined,
  weekday: IsoWeekday,
): boolean {
  if (!staffRow) return false;
  const staffOpen = parseHm(staffRow.start_time?.slice(0, 5));
  const staffClose = parseHm(staffRow.end_time?.slice(0, 5));
  const effective = effectiveWindow(shopHours, staffRow, weekday);
  if (staffOpen === null || staffClose === null || !effective) return false;
  return effective.openMin > staffOpen || effective.closeMin < staffClose;
}

/** Does a leave period cover any of this day? Both ends are ISO strings. */
export function overlapsDay(
  period: { starts_at: string; ends_at: string },
  day: Date,
): boolean {
  const from = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const to = from + 24 * 60 * 60 * 1000;
  const start = new Date(period.starts_at).getTime();
  const end = new Date(period.ends_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start < to && end > from;
}

/** A leave period that covers a whole calendar day, start to end. */
export function isFullDay(period: { starts_at: string; ends_at: string }): boolean {
  const start = new Date(period.starts_at);
  const end = new Date(period.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return (
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000 - 1
  );
}
