import { cn } from "@/lib/utils";

export function Card({
  className,
  hover,
  ...props
}: React.ComponentProps<"div"> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-card shadow-sm",
        hover &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}
