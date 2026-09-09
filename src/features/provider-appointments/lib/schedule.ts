import { DAY_ORDER, type DayKey, type WeeklyHours } from "@/lib/weekly-hours";
import type { AppointmentCard } from "./types";

/**
 * The arithmetic behind the day grid — kept pure and separate from the
 * components so it can be tested without a DOM (this project's vitest runs in
 * `node`, so the pure layer is where test value lives).
 *
 * Everything here counts **minutes since midnight, local time**. The board
 * draws one day at a time in the shop's own timezone, so a minutes-since-
 * midnight number is both the simplest thing to reason about and the thing
 * CSS percentages need.
 */

/** How tall one row of the grid is, in minutes. */
export const SLOT_MINUTES = 30;

export interface DayWindow {
  /** Minutes since midnight. */
  openMin: number;
  closeMin: number;
}

/** `Date.getDay()` is Sunday-first; `DAY_ORDER` is Monday-first. */
export function dayKeyOf(date: Date): DayKey {
  return DAY_ORDER[(date.getDay() + 6) % 7];
}

/** "10:00" → 600. Returns null for anything that isn't a real HH:MM. */
export function parseHm(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 600 → "10:00". Used for the gutter labels, which are then localised. */
export function formatHm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * The shop's open window for one day.
 *
 * `null` means "no grid to draw": either the shop is shut that day or its
 * hours are unusable. The caller decides which message that deserves — this
 * function stays out of the copy business.
 */
export function dayWindow(hours: WeeklyHours | null, date: Date): DayWindow | null {
  if (!hours) return null;
  const day = hours[dayKeyOf(date)];
  if (!day || day.closed) return null;

  const openMin = parseHm(day.open);
  const closeMin = parseHm(day.close);
  if (openMin === null || closeMin === null) return null;

  // A close time at or before open is either a typo or a shop that runs past
  // midnight. Neither can be drawn as a single-day column, so no grid.
  if (closeMin <= openMin) return null;

  return { openMin, closeMin };
}

/** Row boundaries for the gutter: open, open+30, … up to and including close. */
export function timeRows(window: DayWindow, step = SLOT_MINUTES): number[] {
  const rows: number[] = [];
  for (let t = window.openMin; t < window.closeMin; t += step) rows.push(t);
  rows.push(window.closeMin);
  return rows;
}

/** Minutes since midnight for a Date, in the viewer's local zone. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * "2026-09-09" in local time — the board's day identity, and the query key.
 *
 * Not `toISOString().slice(0, 10)`: that converts to UTC first, so in Dhaka
 * (UTC+6) every board before 6am would key itself to the previous day.
 */
export function ymd(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface BlockPosition {
  /** Percentage of the column's height. */
  topPct: number;
  heightPct: number;
  /** True when the booking runs past either edge of the drawn window. */
  clippedStart: boolean;
  clippedEnd: boolean;
}

/**
 * Where one booking sits in its column.
 *
 * Bookings that start before opening or end after closing are clamped rather
 * than dropped — an overrunning appointment is exactly the one an owner needs
 * to see, and silently hiding it would be the worst possible failure. `null`
 * is only for a booking that misses the window entirely.
 */
export function blockPosition(
  appointment: Pick<AppointmentCard, "startsAt" | "endsAt">,
  window: DayWindow,
  day: Date,
): BlockPosition | null {
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  // Minutes are relative to `day`, so a booking on another date lands far
  // outside the window and is rejected by the overlap check below.
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const startMin = (start.getTime() - dayStart) / 60000;
  const endMin = (end.getTime() - dayStart) / 60000;
  if (endMin <= startMin) return null;

  const span = window.closeMin - window.openMin;
  if (endMin <= window.openMin || startMin >= window.closeMin) return null;

  const clampedStart = Math.max(startMin, window.openMin);
  const clampedEnd = Math.min(endMin, window.closeMin);

  return {
    topPct: ((clampedStart - window.openMin) / span) * 100,
    heightPct: ((clampedEnd - clampedStart) / span) * 100,
    clippedStart: startMin < window.openMin,
    clippedEnd: endMin > window.closeMin,
  };
}

/**
 * Where the "now" line goes, as a percentage — or null when now is outside
 * the drawn window, or the board is not showing today.
 */
export function nowLinePct(now: Date, window: DayWindow, day: Date): number | null {
  if (!isSameDay(now, day)) return null;
  const min = minutesOfDay(now);
  if (min < window.openMin || min > window.closeMin) return null;
  return ((min - window.openMin) / (window.closeMin - window.openMin)) * 100;
}

/** Groups the day's bookings by staff id, so each column reads its own list. */
export function groupByStaff(
  appointments: readonly AppointmentCard[],
): Map<string, AppointmentCard[]> {
  const byStaff = new Map<string, AppointmentCard[]>();
  for (const appointment of appointments) {
    const list = byStaff.get(appointment.staffId);
    if (list) list.push(appointment);
    else byStaff.set(appointment.staffId, [appointment]);
  }
  for (const list of byStaff.values()) {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  return byStaff;
}
