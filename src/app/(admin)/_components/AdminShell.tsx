"use client";

import { useState } from "react";
import { Menu, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useIsPlatformAdmin } from "@/features/admin/hooks/use-admin";
import { adminDict } from "@/features/admin/lib/i18n";
import { useT } from "@/lib/i18n";
import { AdminSidebar } from "./AdminSidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: isAdmin, isPending } = useIsPlatformAdmin();
  const t = useT(adminDict);

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  // Middleware already bounces non-admins on the JWT claim; this is the second
  // gate, asked of the database itself — a stale claim never renders the panel.
  if (!isAdmin) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <EmptyState
          icon={<ShieldOff className="h-6 w-6" />}
          title={t("notAdminTitle")}
          description={t("notAdminDesc")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:flex">
      <div
        className="flex items-center justify-between border-b border-line bg-card px-4 py-3 md:hidden"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("openMenuAria")}
          className="grid h-11 w-11 place-items-center rounded-lg text-ink hover:bg-soft"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <button
          type="button"
          aria-label={t("closeMenuAria")}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/50 md:hidden"
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-40 transition-transform duration-200 md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <AdminSidebar onNavigate={() => setOpen(false)} />
      </div>

      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 sm:px-6 md:px-8.5 md:py-7">
        {children}
      </main>
    </div>
  );
}
