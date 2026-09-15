"use client";

import { Card } from "@/components/ui/Card";
import { formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import { AnalyticsSection } from "./AnalyticsSection";
import { topBreakdown, type BreakdownRow } from "../lib/compute-dashboard";

/**
 * A ranked list with a bar behind each row — services, payment methods,
 * membership tiers, popular rewards.
 *
 * One component for four dimensions because the RPC returns one shape for all
 * four (`key`, `label`, `jobs`, `amount`); four near-identical components would
 * drift apart the first time one of them needed a tweak.
 *
 * The share is of the whole breakdown, and the "and N more" line accounts for
 * everything trimmed off the bottom, so a top-six list can never be mistaken
 * for the complete picture.
 */
export function BreakdownSection({
  title,
  icon,
  note,
  data,
  isPending,
  isError,
  onRetry,
  /** Payment-method keys are machine words ("due", "cash") — translate those. */
  labelFor,
  limit = 6,
}: {
  title: string;
  icon?: React.ReactNode;
  note?: string;
  data: BreakdownRow[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  labelFor?: (row: BreakdownRow) => string;
  limit?: number;
}) {
  const t = useT(providerAnalyticsDict);
  const rows = data ?? [];
  const { rows: shown, rest, scale } = topBreakdown(rows, limit);
  const money = (n: number) => formatMoney(Math.round(n));

  return (
    <AnalyticsSection
      title={title}
      icon={icon}
      note={note}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      isEmpty={rows.length === 0}
      defaultOpen={false}
    >
      <Card className="space-y-2.5 p-4">
        <ul className="space-y-2.5">
          {shown.map((row) => (
            <li key={row.key || row.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                  {labelFor ? labelFor(row) : row.label || t("paymentUnknown")}
                </span>
                <span className="font-number shrink-0 text-[13px] font-bold text-ink">
                  ৳{money(row.amount)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full rounded-full bg-accent/70"
                  style={{ width: `${Math.max(2, (row.amount / scale) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted">
                {toBanglaDigits(row.jobs)} · {row.share === null ? "—" : toBanglaDigits(row.share)}%
              </p>
            </li>
          ))}
        </ul>

        {rest.count > 0 && (
          <p className="border-t border-line pt-2 text-[11px] text-muted">
            {t("breakdownOther", toBanglaDigits(rest.count), money(rest.amount))}
          </p>
        )}
      </Card>
    </AnalyticsSection>
  );
}
