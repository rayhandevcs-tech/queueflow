import { cn } from "@/lib/utils";

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: readonly { value: T; label: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }[];
  value: T | undefined;
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
              selected
                ? "border-accent bg-accent text-accent-ink shadow-sm"
                : "border-line bg-card text-muted hover:border-accent/40 hover:bg-soft",
            )}
          >
            {Icon && <Icon className="h-5 w-5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
