"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "accent" | "live" | "good";
  href?: string;
}

const TONE_ICON: Record<NonNullable<Props["tone"]>, string> = {
  default: "bg-soft text-muted",
  accent: "bg-accent/10 text-accent",
  live: "bg-live-soft text-live",
  good: "bg-good-soft text-good",
};

export function StatCard({ label, value, hint, icon, tone = "default", href }: Props) {
  const body = (
    <Card
      hover={!!href}
      className={cn("flex h-full items-start gap-3 p-4", href && "cursor-pointer")}
    >
      {icon && (
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", TONE_ICON[tone])}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-number text-xl font-bold text-ink">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted">{label}</p>
        {hint && <p className="mt-1 truncate text-[11px] text-muted/80">{hint}</p>}
      </div>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
