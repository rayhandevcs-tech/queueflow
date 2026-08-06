"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LocateFixed, LocateOff, Map, MapPin, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { LocationStatus } from "../hooks/use-user-location";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

const LocationPickerMap = dynamic(
  () => import("@/components/map/LocationPickerMap"),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-65 w-full place-items-center rounded-xl border border-line bg-soft">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    ),
  },
);

export function LocationPrompt({
  status,
  error,
  onRequest,
  onManualPick,
}: {
  status: LocationStatus;
  error: string | null;
  onRequest: () => void;
  onManualPick: (lat: number, lng: number) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const t = useT(customerExploreDict);

  if (status === "granted" || dismissed) return null;

  const locating = status === "locating";
  const denied = status === "denied";
  const unsupported = status === "unsupported";

  return (
    <>
      <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.07] to-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-accent shadow-xs">
            <MapPin className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{t("locationPromptText")}</p>
            {error && <p className="mt-0.5 text-xs text-live">{error}</p>}
          </div>
          <button
            type="button"
            aria-label={t("dismissLocationAria")}
            onClick={() => setDismissed(true)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-card hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {/* The primary action states what it's doing at every step —
              locating, blocked, or unsupported — instead of failing silently
              and leaving the button looking untouched. */}
          <button
            type="button"
            onClick={onRequest}
            disabled={locating || unsupported}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm transition-all",
              "bg-accent text-accent-ink hover:shadow-glow active:scale-[0.98]",
              "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
            )}
          >
            {locating ? (
              <Spinner className="h-4 w-4" />
            ) : denied ? (
              <LocateOff className="h-4 w-4" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            {locating ? t("locating") : denied ? t("retryLocation") : t("giveLocation")}
          </button>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink transition-colors hover:border-accent/40 hover:text-accent"
          >
            <Map className="h-4 w-4" />
            {t("pickManually")}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-30 grid place-items-end sm:place-items-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-card p-5">
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-soft"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="mb-3 font-display text-base font-bold text-ink">{t("pickLocationOnMap")}</p>
            <div className="overflow-hidden rounded-xl border border-line">
              <LocationPickerMap
                lat={null}
                lng={null}
                onPick={(lat, lng) => {
                  onManualPick(lat, lng);
                  setPickerOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
