const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const BN_MONTHS = [
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

/** "MM:SS", matching the design handoff's fmtMMSS. */
export function fmtMMSS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** "N মিনিট" under an hour, "Hh ঘণ্টা MM মিনিট" beyond — matching the design handoff's fmtWait. */
export function fmtWait(totalSec: number): { big: string; unit: string; label: string } {
  const m = Math.max(0, Math.round(totalSec / 60));
  if (m < 60) return { big: String(m), unit: "মিনিট", label: `${m} মিনিট` };
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return { big: `${h}ঘ ${mm}`, unit: "মিনিট", label: `${h} ঘণ্টা ${mm} মিনিট` };
}

/** "২৬ জুন" — Bangla-digit day + Bangla Gregorian month name, matching the design handoff. */
export function formatBanglaDate(date: Date): string {
  const day = String(date.getDate())
    .split("")
    .map((d) => BN_DIGITS[Number(d)])
    .join("");
  return `${day} ${BN_MONTHS[date.getMonth()]}`;
}

/** Grouped Latin-digit amount, matching the design handoff's money(). */
export function formatMoney(n: number): string {
  return n.toLocaleString("en-US");
}
