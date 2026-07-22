"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import Link from "next/link";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import type { Shop } from "@/types";

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125]; // Dhaka

function pinIcon(count: number) {
  const color = count === 0 ? "#2e7d5b" : "#1c5d44";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:34px;height:34px">
        <div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:${color};border:2px solid #f4f1ea;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>
        <div style="position:absolute;top:-6px;left:16px;min-width:16px;padding:0 4px;height:16px;border-radius:8px;background:#1b1812;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center">${count}</div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [11, 26],
    popupAnchor: [0, -22],
  });
}

interface LocatedShop extends Shop {
  latitude: number;
  longitude: number;
}

export default function ShopMapInner({
  shops,
  counts,
  waitMin,
}: {
  shops: LocatedShop[];
  counts: Record<string, number>;
  waitMin: Record<string, number>;
}) {
  const avgLat = shops.reduce((a, s) => a + s.latitude, 0) / shops.length;
  const avgLng = shops.reduce((a, s) => a + s.longitude, 0) / shops.length;
  const center: [number, number] = shops.length ? [avgLat, avgLng] : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: 440, width: "100%" }}
      className="rounded-xl"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {shops.map((shop) => {
        const count = counts[shop.id] ?? 0;
        const wait = waitMin[shop.id] ?? 0;
        return (
          <Marker
            key={shop.id}
            position={[shop.latitude, shop.longitude]}
            icon={pinIcon(count)}
          >
            <Popup>
              <div className="min-w-[160px] space-y-1">
                <p className="text-sm font-semibold text-ink">{shop.name}</p>
                <p className="text-xs text-muted">
                  {BUSINESS_TYPE_LABEL[shop.business_type]}
                  {shop.address ? ` · ${shop.address}` : ""}
                </p>
                <p className="text-xs font-medium text-ink">
                  {count === 0 ? "কোনো সিরিয়াল নেই" : `চলছে ${count} সিরিয়াল · ~${wait} মিন ওয়েট`}
                </p>
                <Link
                  href={`/explore/${shop.id}`}
                  className="mt-1 inline-block text-xs font-semibold text-accent underline"
                >
                  দোকান দেখো
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
