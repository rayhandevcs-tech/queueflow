"use client";

import { useCallback, useEffect, useState } from "react";
import { rememberLocation } from "@/lib/last-location";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

export type LocationStatus = "idle" | "prompt" | "locating" | "granted" | "denied" | "unsupported";

interface UserLocationState {
  coords: { lat: number; lng: number } | null;
  status: LocationStatus;
  error: string | null;
  requestLocation: () => void;
  setManualLocation: (lat: number, lng: number) => void;
}

/** Mirrors LocationPickerField's busy/error/fallback UX for the customer-facing "find me" prompt. */
export function useUserLocation(): UserLocationState {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<LocationStatus>(() =>
    typeof navigator !== "undefined" && typeof navigator.permissions?.query === "function"
      ? "idle"
      : "prompt",
  );
  const [error, setError] = useState<string | null>(null);
  const t = useT(customerExploreDict);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      setError(t("locationUnsupported"));
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        // Shared with the booking flow so it can estimate travel time without
        // raising a second permission prompt (src/lib/last-location.ts).
        rememberLocation(next);
        setStatus("granted");
      },
      () => {
        setStatus("denied");
        setError(t("locationDenied"));
      },
    );
  }, [t]);

  const setManualLocation = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
    rememberLocation({ lat, lng });
    setStatus("granted");
    setError(null);
  }, []);

  useEffect(() => {
    if (typeof navigator.permissions?.query !== "function") return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (cancelled) return;
        if (result.state === "granted") {
          requestLocation();
        } else if (result.state === "denied") {
          setStatus("denied");
        } else {
          setStatus("prompt");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("prompt");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { coords, status, error, requestLocation, setManualLocation };
}
