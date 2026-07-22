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
