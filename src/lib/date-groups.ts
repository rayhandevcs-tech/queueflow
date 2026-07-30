import { formatBanglaDate } from "@/lib/format-wait";
import { getStoredLanguage } from "@/lib/i18n";

/** "আজ" / "গতকাল" / date — for grouping any date-stamped list by day. Language-aware. */
export function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  const en = getStoredLanguage() === "en";
  if (diffDays === 0) return en ? "Today" : "আজ";
  if (diffDays === 1) return en ? "Yesterday" : "গতকাল";
  return formatBanglaDate(d);
}

export function groupByDay<T>(items: T[], getIso: (item: T) => string): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = dayLabel(getIso(item));
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return [...groups.entries()];
}
