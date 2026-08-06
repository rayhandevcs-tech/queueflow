import { cn } from "@/lib/utils";
import { Card, type CardTone } from "./Card";

/**
 * The "one big number with a label under it" pattern, which the home page,
 * the profile and the income dashboard were each drawing slightly
 * differently — different radii, different digit sizes, different label
 * colours. One component means those can't drift again.
 */
export function StatTile({
  value,
  label,
  hint,
  icon,
  tone = "plain",
  accentValue,
  size = "md",
  className,
}: {
  value: React.ReactNode;
  label: string;
  /** Small line under the label — a comparison, a breakdown, a caveat. */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: CardTone;
  /** Colours the number itself; the label always stays muted. */
  accentValue?: "accent" | "good" | "live" | "brass" | "ink";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueSize =
    size === "lg" ? "text-[32px]" : size === "sm" ? "text-lg" : "text-[26px]";

  return (
    <Card tone={tone} className={cn("p-4", className)}>
      {icon && (
        <span className="mb-2 inline-grid h-8 w-8 place-items-center rounded-full bg-card text-muted shadow-xs">
          {icon}
        </span>
      )}
      <p
        className={cn(
          "font-number leading-none font-extrabold tabular-nums",
          valueSize,
          accentValue === "accent" && "text-accent",
          accentValue === "good" && "text-good",
          accentValue === "live" && "text-live",
          accentValue === "brass" && "text-brass",
          (!accentValue || accentValue === "ink") && "text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-medium text-muted">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-muted/80">{hint}</p>}
    </Card>
  );
}
