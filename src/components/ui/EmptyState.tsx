import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  dashed,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  dashed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl p-8 text-center",
        dashed
          ? "border border-dashed border-line"
          : "border border-line bg-card shadow-sm",
        className,
      )}
    >
      {icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-soft text-muted">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
