"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125]; // Dhaka

// The pin follows the theme. Leaflet builds this marker from an HTML string
// rather than from a styled component, so it cannot pick up a Tailwind class —
// but a `var()` in an inline style resolves against the document just as well,
// which is all the theme system needs. Sprint 11 converted the pins in
// ShopMapInner the same way and missed this one; the final audit found it.
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:var(--qf-accent);border:2px solid var(--qf-card);transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPickerMap({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={lat != null ? 15 : 12}
      style={{ height: 260, width: "100%" }}
      className="rounded-xl"
    >
      {/* Same basemap as the Explore map — two different-looking maps in one
          product is the kind of drift the design system exists to prevent. */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        maxZoom={20}
      />
      <ClickHandler onPick={onPick} />
      {lat != null && lng != null && <Marker position={[lat, lng]} icon={pinIcon} />}
    </MapContainer>
  );
}
