"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/Wordmark";
import { useT } from "@/lib/i18n";
import { providerCatalogDict } from "@/features/provider-catalog/lib/i18n";
import { ProviderAssistantWidget } from "./ProviderAssistantWidget";
import { ShopStatusBanner } from "@/features/provider-catalog/components/ShopStatusBanner";
import { ProviderSidebar } from "./ProviderSidebar";

export function ProviderShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = useT(providerCatalogDict);

  return (
    <div className="min-h-dvh md:flex">
      <div
        className="flex items-center justify-between border-b border-line bg-card px-4 py-3 md:hidden"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link href="/dashboard">
          <Wordmark size="sm" />
        </Link>
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
        <ProviderSidebar onNavigate={() => setOpen(false)} />
      </div>

      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 sm:px-6 md:px-8.5 md:py-7">
        <ShopStatusBanner />
        {children}
      </main>

      <ProviderAssistantWidget />
    </div>
  );
}
