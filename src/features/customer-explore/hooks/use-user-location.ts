"use client";

import { useCallback, useEffect, useState } from "react";

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

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      setError("এই ব্রাউজার লোকেশন সাপোর্ট করে না।");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      () => {
        setStatus("denied");
        setError("লোকেশন পাওয়া যায়নি — ম্যানুয়ালি বেছে নাও।");
      },
    );
  }, []);

  const setManualLocation = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng });
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
