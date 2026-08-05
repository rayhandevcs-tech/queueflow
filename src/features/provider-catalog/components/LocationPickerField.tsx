"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { useT } from "@/lib/i18n";
import { providerCatalogDict } from "../lib/i18n";

const LocationPickerMap = dynamic(() => import("@/components/map/LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[260px] w-full place-items-center rounded-xl border border-line bg-soft">
      <Spinner className="h-5 w-5 text-muted" />
    </div>
  ),
});

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  /** Best-effort reverse-geocoded address — only fires when "current location" actually resolves one. */
  onAddressDetected?: (address: string) => void;
}

export function LocationPickerField({ lat, lng, onChange, onAddressDetected }: Props) {
  const { locate, busy: geoBusy, error: geoError } = useCurrentLocation();
  const t = useT(providerCatalogDict);
  // Bumping this remounts the map centered on the freshly picked geolocation.
  const [mapKey, setMapKey] = useState(0);

  const handleUseCurrentLocation = async () => {
    const result = await locate();
    if (!result) return;
    onChange(result.lat, result.lng);
    if (result.address) onAddressDetected?.(result.address);
    setMapKey((k) => k + 1);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink">{t("locationOnMapLabel")}</label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void handleUseCurrentLocation()}
          loading={geoBusy}
        >
          <LocateFixed className="h-3.5 w-3.5" />
          {geoBusy ? t("locatingLabel") : t("useCurrentLocationCta")}
        </Button>
      </div>
      <p className="text-xs text-muted">{t("tapMapHint")}</p>
      <div className="overflow-hidden rounded-xl border border-line shadow-xs">
        <LocationPickerMap key={mapKey} lat={lat} lng={lng} onPick={onChange} />
      </div>
      {lat != null && lng != null && (
        <p className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3 w-3" />
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      )}
      {geoError && <p className="text-xs text-live">{geoError}</p>}
    </div>
  );
}
