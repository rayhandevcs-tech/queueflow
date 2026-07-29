"use client";

import { cn } from "@/lib/utils";

export interface TabBarItem {
  id: string;
  label: string;
}

interface Props {
  tabs: TabBarItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function TabBar({ tabs, active, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "flex gap-1.5 overflow-x-auto border-b border-line pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              selected
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
