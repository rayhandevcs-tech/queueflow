"use client";

import { BellRing } from "lucide-react";
import type { Shop } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useMyFavoriteRows } from "../hooks/use-retention";
import { customerProfileDict } from "../lib/i18n";

/** Matches the DB's 5–120 range; "off" is null, not zero. */
const THRESHOLDS = [10, 20, 30] as const;

/**
 * Turns a favourite from a bookmark into a standing request.
 *
 * Until now hearting a shop did nothing but list it here. The alert is opt-in
 * per shop on purpose — a customer will happily walk to the place next door on
 * ten minutes' notice, and not at all for one across town.
 *
 * Deliberately its own row list rather than a control on the favourite cards
 * above: those are links, and a button inside an anchor is the nesting bug
 * this codebase has already fixed once.
 */
export function FavoriteAlertsCard({ shopsById }: { shopsById: Record<string, Shop> }) {
  const { favorites, setAlert } = useMyFavoriteRows();
  const showToast = useToast();
  const t = useT(customerProfileDict);

  if (favorites.length === 0) return null;

  return (
    <div className="mt-3 rounded-[18px] border border-line bg-card p-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
        <BellRing className="h-3.5 w-3.5" />
        {t("waitAlertHeading")}
      </p>
      <p className="mt-1 text-[11px] text-muted">{t("waitAlertHint")}</p>

      <ul className="mt-3 space-y-3">
        {favorites.map((fav) => {
          const shop = shopsById[fav.shop_id];
          return (
            <li key={fav.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
              <p className="truncate text-[13px] font-semibold text-ink">
                {shop?.name ?? t("shopFallback")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setAlert.mutate({ favoriteId: fav.id, waitAlertMin: null })
                  }
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                    fav.wait_alert_min === null
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line bg-card text-muted",
                  )}
                >
                  {t("waitAlertOff")}
                </button>
                {THRESHOLDS.map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() =>
                      setAlert.mutate(
                        { favoriteId: fav.id, waitAlertMin: min },
                        { onSuccess: () => showToast(t("waitAlertSetToast", min)) },
                      )
                    }
                    className={cn(
                      "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                      fav.wait_alert_min === min
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line bg-card text-muted",
                    )}
                  >
                    {t("waitAlertUnder", min)}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
