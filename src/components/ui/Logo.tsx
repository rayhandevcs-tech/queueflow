import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { site } from "@/config/site";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 font-display text-sm font-bold text-ink",
        className,
      )}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink shadow-sm">
        <Sparkles className="h-4 w-4" />
      </span>
      {site.name}
    </span>
  );
}
