"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
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
}

export function LocationPickerField({ lat, lng, onChange }: Props) {
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  // Bumping this remounts the map centered on the freshly picked geolocation.
  const [mapKey, setMapKey] = useState(0);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("This browser doesn't support location.");
      return;
    }
    setGeoBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setMapKey((k) => k + 1);
        setGeoBusy(false);
      },
      () => {
        setGeoError("Couldn't get your location — pick it on the map instead.");
        setGeoBusy(false);
      },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink">Location on map</label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={useCurrentLocation}
          loading={geoBusy}
        >
          <LocateFixed className="h-3.5 w-3.5" />
          {geoBusy ? "Locating…" : "Use current location"}
        </Button>
      </div>
      <p className="text-xs text-muted">Tap the map to place a pin at your shop.</p>
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
