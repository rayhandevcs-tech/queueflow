import { getStoredLanguage } from "@/lib/i18n";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

export const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Short month labels for chart axes, matching the design handoff's bar-chart labels. */
export const BN_MONTHS_SHORT = [
  "জান",
  "ফেব",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুল",
  "আগ",
  "সেপ",
  "অক্ট",
  "নভ",
  "ডিস",
];

export const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Language-aware short month label — used by chart axes (income/spending/analytics trends). */
export function monthShortLabel(monthIndex: number): string {
  return getStoredLanguage() === "en" ? EN_MONTHS_SHORT[monthIndex] : BN_MONTHS_SHORT[monthIndex];
}

/** "MM:SS", matching the design handoff's fmtMMSS. */
export function fmtMMSS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** "N মিনিট" under an hour, "Hh ঘণ্টা MM মিনিট" beyond — matching the design handoff's fmtWait. Language-aware. */
export function fmtWait(totalSec: number): { big: string; unit: string; label: string } {
  const m = Math.max(0, Math.round(totalSec / 60));
  const en = getStoredLanguage() === "en";
  if (m < 60) {
    return en
      ? { big: String(m), unit: "min", label: `${m} min` }
      : { big: String(m), unit: "মিনিট", label: `${m} মিনিট` };
  }
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return en
    ? { big: `${h}h ${mm}`, unit: "min", label: `${h}h ${mm}m` }
    : { big: `${h}ঘ ${mm}`, unit: "মিনিট", label: `${h} ঘণ্টা ${mm} মিনিট` };
}

/** Converts any integer's Latin digits to Bangla digits, e.g. 2025 → "২০২৫". In English mode, returns the digits unchanged. */
export function toBanglaDigits(n: number): string {
  if (getStoredLanguage() === "en") return String(n);
  return String(n)
    .split("")
    .map((c) => (c >= "0" && c <= "9" ? BN_DIGITS[Number(c)] : c))
    .join("");
}

/** "২৬ জুন" / "26 Jun" — language-aware day + Gregorian month name. */
export function formatBanglaDate(date: Date): string {
  if (getStoredLanguage() === "en") {
    return `${date.getDate()} ${EN_MONTHS_SHORT[date.getMonth()]}`;
  }
  return `${toBanglaDigits(date.getDate())} ${BN_MONTHS[date.getMonth()]}`;
}

/** "১০:৩০ AM" / "10:30 AM" — language-aware 12h clock time. */
export function formatBanglaTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  if (getStoredLanguage() === "en") {
    return `${hours}:${String(minutes).padStart(2, "0")} ${period}`;
  }
  return `${toBanglaDigits(hours)}:${toBanglaDigits(minutes).padStart(2, toBanglaDigits(0))} ${period}`;
}

/** Grouped Latin-digit amount, matching the design handoff's money(). */
export function formatMoney(n: number): string {
  return n.toLocaleString("en-US");
}
