"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import { isNA, type Metric } from "../lib/compute-dashboard";

/**
 * The four states every analytics section owes the owner, in one place.
 *
 * · **loading** — skeletons shaped like the tiles that are coming, so the page
 *   does not jump when they land.
 * · **error** — says so, with a retry. Never a zero: "৳0 collected" and "we
 *   could not reach the database" look identical on a dashboard and mean
 *   opposite things.
 * · **empty** — the query worked and the answer is "nothing happened in this
 *   period". That is a real, useful answer, so it gets its own wording rather
 *   than a grid of zeros.
 * · **unavailable** — the programme is switched off, or this business type
 *   does not use this section at all. Explained, not hidden.
 *
 * Sections are open by default and collapsible. The brief asks not to
 * overwhelm the first viewport; collapsing is how that is done **without
 * hiding information**, because every heading stays on the page and one tap
 * opens it.
 */
export function AnalyticsSection({
  title,
  icon,
  subtitle,
  note,
  isPending,
  isError,
  onRetry,
  /** The query succeeded but the period holds nothing to report. */
  isEmpty,
  emptyText,
  /** This section cannot apply — a programme that is off, a model not in use. */
  unavailableText,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  note?: string;
  isPending?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyText?: string;
  unavailableText?: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  const t = useT(providerAnalyticsDict);
  const [open, setOpen] = useState(defaultOpen);
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
        >
          {icon && <span className="shrink-0 text-muted">{icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[17px] font-bold break-words text-ink">
              {title}
            </span>
            {subtitle && (
              <span className="block text-[11px] leading-snug text-muted">{subtitle}</span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted transition-transform",
              !open && "-rotate-90",
            )}
          />
        </button>

        {note && (
          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            aria-label={title}
            aria-expanded={noteOpen}
            className="grid h-11 w-11 shrink-0 place-items-center text-muted hover:text-ink"
          >
            <Info className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* How a number was arrived at, on demand. Folded away by default so it
          informs the owner who asks without shouting at the one who doesn't. */}
      {note && noteOpen && (
        <p className="rounded-xl bg-soft px-3.5 py-3 text-[12px] leading-relaxed text-muted">
          {note}
        </p>
      )}

      {open && (
        <div>
          {isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-21 rounded-3xl" />
              ))}
            </div>
          ) : isError ? (
            <Card tone="live" className="flex flex-wrap items-center gap-3 p-4">
              <AlertTriangle className="h-4 w-4 shrink-0 text-live" />
              <p className="min-w-0 flex-1 text-[13px] text-ink">{t("loadFailed")}</p>
              {onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry}>
                  {t("retry")}
                </Button>
              )}
            </Card>
          ) : unavailableText ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-[12px] leading-snug text-muted">
              {unavailableText}
            </p>
          ) : isEmpty ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-[12px] leading-snug text-muted">
              {emptyText ?? t("emptyRange")}
            </p>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}

/** Two tiles a row at 320px, four on a tablet. Nothing ever clipped. */
export function StatGrid({
  columns = 4,
  children,
}: {
  columns?: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        columns === 4 && "sm:grid-cols-4",
        columns === 3 && "sm:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

/**
 * A percentage, with N/A kept distinct from zero.
 *
 * `0` prints "০%" because zero is a fact. `null` prints the N/A word, and the
 * tile carries a `title` explaining that nothing could be calculated — the one
 * distinction the whole dashboard rests on.
 */
export function PercentText({ value }: { value: Metric }) {
  const t = useT(providerAnalyticsDict);
  if (isNA(value)) {
    return (
      <span className="text-[15px] font-semibold text-muted" title={t("naWhy")}>
        {t("na")}
      </span>
    );
  }
  return <>{toBanglaDigits(value as number)}%</>;
}

/** The same rule for a plain number: a real 0, or the N/A dash. */
export function NumberText({
  value,
  suffix,
}: {
  value: Metric;
  suffix?: string;
}) {
  const t = useT(providerAnalyticsDict);
  if (isNA(value)) {
    return (
      <span className="text-[15px] font-semibold text-muted" title={t("naWhy")}>
        {t("na")}
      </span>
    );
  }
  return (
    <>
      {toBanglaDigits(value as number)}
      {suffix && <span className="text-sm font-semibold">{suffix}</span>}
    </>
  );
}
