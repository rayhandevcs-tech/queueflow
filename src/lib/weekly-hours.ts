import { getStoredLanguage } from "@/lib/i18n";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DayHours {
  open: string | null;
  close: string | null;
  closed: boolean;
}

export type WeeklyHours = Record<DayKey, DayHours>;

export const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABEL_BN: Record<DayKey, string> = {
  mon: "সোমবার",
  tue: "মঙ্গলবার",
  wed: "বুধবার",
  thu: "বৃহস্পতিবার",
  fri: "শুক্রবার",
  sat: "শনিবার",
  sun: "রবিবার",
};

const DAY_LABEL_EN: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Language-aware day name — reads the current language internally so callers don't need to. */
export function dayLabel(day: DayKey): string {
  return getStoredLanguage() === "en" ? DAY_LABEL_EN[day] : DAY_LABEL_BN[day];
}

export function emptyDayHours(): DayHours {
  return { open: "10:00", close: "20:00", closed: false };
}

export function emptyWeeklyHours(): WeeklyHours {
  return DAY_ORDER.reduce((acc, day) => {
    acc[day] = emptyDayHours();
    return acc;
  }, {} as WeeklyHours);
}

/** Safe accessor for the jsonb weekly_hours column — tolerates missing/malformed data. */
export function parseWeeklyHours(value: unknown): WeeklyHours | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const result = {} as WeeklyHours;
  for (const day of DAY_ORDER) {
    const d = raw[day];
    if (!d || typeof d !== "object") return null;
    const dd = d as Record<string, unknown>;
    result[day] = {
      open: typeof dd.open === "string" ? dd.open : null,
      close: typeof dd.close === "string" ? dd.close : null,
      closed: dd.closed === true,
    };
  }
  return result;
}

export function formatDayHours(hours: DayHours | undefined): string {
  const en = getStoredLanguage() === "en";
  if (!hours || hours.closed) return en ? "Closed" : "বন্ধ";
  if (!hours.open || !hours.close) return en ? "Not set" : "সেট করা হয়নি";
  return `${hours.open} – ${hours.close}`;
}
