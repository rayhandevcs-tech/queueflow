"use client";

import { useState } from "react";
import { translate, type Dict } from "@/lib/i18n";

const dict = {
  unsupported: {
    bn: "এই ব্রাউজার লোকেশন সাপোর্ট করে না — ম্যাপে চেপে বেছে নাও।",
    en: "This browser doesn't support location — pick it on the map instead.",
  },
  failed: {
    bn: "লোকেশন পাওয়া যায়নি — ম্যাপে চেপে বেছে নাও।",
    en: "Couldn't get your location — pick it on the map instead.",
  },
} satisfies Dict;

export interface DetectedLocation {
  lat: number;
  lng: number;
  /** null when reverse-geocoding failed/rate-limited — caller keeps the existing address. */
  address: string | null;
}

/**
 * Shared across provider shop settings (Sprint 19) and customer address
 * picking (Sprint 20+) — browser geolocation, then a best-effort reverse
 * geocode via OSM Nominatim (free, no API key) to auto-fill an address.
 * Nominatim failing/rate-limiting is expected at low volume and never
 * blocks the caller — lat/lng still resolve, just without an address.
 */
export function useCurrentLocation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function locate(): Promise<DetectedLocation | null> {
    if (!navigator.geolocation) {
      setError(translate(dict, "unsupported"));
      return null;
    }

    setBusy(true);
    setError(null);

    let position: GeolocationPosition;
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10_000,
          maximumAge: 60_000,
        }),
      );
    } catch {
      setError(translate(dict, "failed"));
      setBusy(false);
      return null;
    }

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    let address: string | null = null;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`,
      );
      if (res.ok) {
        const data = (await res.json()) as { display_name?: unknown };
        address = typeof data.display_name === "string" ? data.display_name : null;
      }
    } catch {
      // Rate-limited or offline — lat/lng are still good, just no address.
    }

    setBusy(false);
    return { lat, lng, address };
  }

  return { locate, busy, error };
}
