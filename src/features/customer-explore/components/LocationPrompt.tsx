"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LocateFixed, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
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

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 shadow-xs">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t("locationPromptText")}</p>
          {error && <p className="mt-0.5 text-xs text-live">{error}</p>}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-soft"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2.5 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onRequest}
          loading={status === "locating"}
        >
          <LocateFixed className="h-3.5 w-3.5" />
          {status === "locating" ? t("locating") : t("giveLocation")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          {t("pickManually")}
        </Button>
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
