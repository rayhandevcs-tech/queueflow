"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { CustomerBottomNav } from "./CustomerBottomNav";
import { CustomerSidebarPanel } from "./CustomerSidebarPanel";

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh md:flex">
      <div className="flex items-center justify-between border-b border-line bg-card px-4 py-3 md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="মেনু খোলো"
          className="grid h-9 w-9 place-items-center rounded-lg text-ink hover:bg-soft"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <button
          type="button"
          aria-label="মেনু বন্ধ করো"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/50 md:hidden"
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <CustomerSidebarPanel onNavigate={() => setOpen(false)} />
      </div>

      <main className="mx-auto min-w-0 max-w-md flex-1 px-4 pt-6 pb-28 md:pb-10">{children}</main>

      <CustomerBottomNav />
    </div>
  );
}
