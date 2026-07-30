"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccordionItem({
  question,
  answer,
  defaultOpen,
  className,
}: {
  question: string;
  answer: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div className={cn("rounded-[14px] border border-line bg-card", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="text-sm font-semibold text-ink">{question}</span>
        <ChevronDown
          className={cn(
            "h-4.5 w-4.5 shrink-0 text-muted transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <p className="px-4 pb-4 text-sm leading-relaxed text-muted">{answer}</p>}
    </div>
  );
}
