"use client";

import { ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { useT } from "@/lib/i18n";
import type { Shop } from "@/types";
import { useShopMutations } from "../hooks/use-my-shop";
import { providerCatalogDict } from "../lib/i18n";

/**
 * "We serve women only."
 *
 * Saved on toggle rather than with the settings form, the same way the
 * open/closed switch is. Two reasons: the owner gets the answer immediately
 * instead of hunting for Save, and — because migrations here are run by hand —
 * a deploy that lands before `20260916` fails on this one write instead of
 * taking every shop-settings save down with it.
 */
export function WomenOnlyToggle({ shop }: { shop: Shop }) {
  const { update } = useShopMutations();
  const t = useT(providerCatalogDict);

  // `?? false` for exactly that window: the column may not exist yet.
  const checked = shop.women_only ?? false;

  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{t("womenOnlyLabel")}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">{t("womenOnlyHint")}</p>
          </div>
        </div>
        <Switch
          checked={checked}
          disabled={update.isPending}
          onChange={(next) => update.mutate({ shopId: shop.id, patch: { women_only: next } })}
        />
      </div>

      {update.error && <p className="mt-2 text-xs text-live">{t("saveFailed")}</p>}
    </div>
  );
}
