import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsRow({
  href,
  icon,
  label,
  danger,
  className,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-[14px] p-3.5 transition-colors hover:bg-soft",
        className,
      )}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
          danger ? "bg-live-soft text-live" : "bg-accent/10 text-accent",
        )}
      >
        {icon}
      </div>
      <span className={cn("flex-1 text-sm font-semibold", danger ? "text-live" : "text-ink")}>
        {label}
      </span>
      <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted" />
    </Link>
  );
}
