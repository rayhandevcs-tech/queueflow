import { cn } from "@/lib/utils";

export function CountdownRing({
  size = 210,
  strokeWidth = 14,
  progress,
  trackClassName = "stroke-white/10",
  ringClassName = "stroke-live",
  className,
  children,
}: {
  /** Fraction of time remaining, 1 = full, 0 = done. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  trackClassName?: string;
  ringClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-1000 ease-linear", ringClassName)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
