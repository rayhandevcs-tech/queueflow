"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Right-align numeric columns, widen a name column, etc. */
  className?: string;
}

interface Props<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  /**
   * Card body rendered instead of the table below md. Admin lists are
   * desktop-first (the operator is at a laptop), but approve/suspend still has
   * to work one-handed on a phone — so the same rows re-render as cards rather
   * than forcing a horizontal scroll.
   */
  mobileCard: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  mobileCard,
}: Props<T>) {
  if (loading) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Mobile: cards */}
      <ul className="space-y-2.5 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                "rounded-2xl border border-line bg-card p-3.5 shadow-sm",
                onRowClick && "cursor-pointer transition-colors hover:bg-soft",
              )}
            >
              {mobileCard(row)}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table. The wrapper scrolls, never the page body. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-card shadow-sm md:block">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-soft/60">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    "px-3.5 py-2.5 text-left text-[11px] font-bold tracking-wide text-muted uppercase",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-line/70 last:border-b-0",
                  onRowClick && "cursor-pointer transition-colors hover:bg-soft",
                )}
              >
                {columns.map((col) => (
                  <td key={col.id} className={cn("px-3.5 py-3 align-middle", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
