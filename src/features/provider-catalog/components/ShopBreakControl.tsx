"use client";

import { useState } from "react";
import { Coffee, Pause, Play } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useNowMs } from "@/hooks/use-now";
import { breakMinutesLeft } from "@/lib/shop-availability";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Shop } from "@/types";
import { useShopMutations } from "../hooks/use-my-shop";
import { providerCatalogDict } from "../lib/i18n";

const DURATIONS = [15, 30, 45, 60] as const;

/**
 * A shop-wide pause with the ETAs following along.
 *
 * Before this the only way to stop the queue for twenty minutes was to close
 * the shop — which hides it from Explore entirely and tells the people already
 * waiting nothing. Jumu'ah alone makes that unworkable for a Bangladeshi
 * salon, so the reasons are presets rather than a free-text box nobody fills.
 */
export function ShopBreakControl({ shop }: { shop: Shop }) {
  const t = useT(providerCatalogDict);
  const showToast = useToast();
  const { setBreak } = useShopMutations();
  const nowMs = useNowMs(30_000);

  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<number>(20);
  const [reason, setReason] = useState<string>("");

  const REASONS = [t("breakReasonPrayer"), t("breakReasonMeal"), t("breakReasonOther")];

  const left = breakMinutesLeft(shop, nowMs);
  const onBreak = left > 0;

  const start = () => {
    setBreak.mutate(
      { shopId: shop.id, minutes, reason: reason || null },
      {
        onSuccess: () => {
          showToast(t("breakStartedToast", minutes));
          setOpen(false);
        },
        onError: () => showToast(t("breakFailedToast")),
      },
    );
  };

  const end = () => {
    setBreak.mutate(
      { shopId: shop.id, minutes: 0 },
      {
        onSuccess: () => showToast(t("breakEndedToast")),
        onError: () => showToast(t("breakFailedToast")),
      },
    );
  };

  if (onBreak) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-brass-soft px-3.5 py-2.5">
        <Coffee className="h-4 w-4 shrink-0 text-brass" />
        <p className="min-w-0 flex-1 text-xs font-semibold text-brass">
          {shop.break_reason
            ? t("onBreakWithReason", left, shop.break_reason)
            : t("onBreak", left)}
        </p>
        <Button size="sm" variant="outline" loading={setBreak.isPending} onClick={end}>
          <Play className="h-3.5 w-3.5" />
          {t("endBreakCta")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Pause className="h-4 w-4" />
        {t("takeBreakCta")}
      </Button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("breakSheetTitle")}>
        <div className="space-y-4">
          <p className="text-xs text-muted">{t("breakSheetHint")}</p>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted uppercase">{t("breakHowLong")}</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMinutes(d)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                    minutes === d
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line bg-card text-ink",
                  )}
                >
                  {t("minutesChip", d)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted uppercase">{t("breakWhy")}</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason((prev) => (prev === r ? "" : r))}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                    reason === r
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line bg-card text-ink",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={setBreak.isPending}>
              {t("breakCancelCta")}
            </Button>
            <Button loading={setBreak.isPending} onClick={start}>
              <Coffee className="h-4 w-4" />
              {t("startBreakCta")}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
