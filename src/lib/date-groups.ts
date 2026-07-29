import { formatBanglaDate } from "@/lib/format-wait";

/** "আজ" / "গতকাল" / Bangla date — for grouping any date-stamped list by day. */
export function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "আজ";
  if (diffDays === 1) return "গতকাল";
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
