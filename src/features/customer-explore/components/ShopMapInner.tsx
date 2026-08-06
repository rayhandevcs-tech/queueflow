"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import Link from "next/link";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import type { Shop } from "@/types";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { shopAvailability } from "@/lib/shop-availability";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125]; // Dhaka

const userIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#2e7dd6;border:3px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function pinIcon(count: number) {
  const color = count === 0 ? "#2e7d5b" : "#db4a4a";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:34px;height:34px">
        <div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:${color};border:2px solid #ffffff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>
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
  userLocation,
}: {
  shops: LocatedShop[];
  counts: Record<string, number>;
  waitMin: Record<string, number>;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const t = useT(customerExploreDict);
  const businessTypeT = useT(BUSINESS_TYPE_LABEL);

  const avgLat = shops.reduce((a, s) => a + s.latitude, 0) / shops.length;
  const avgLng = shops.reduce((a, s) => a + s.longitude, 0) / shops.length;
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : shops.length
      ? [avgLat, avgLng]
      : DEFAULT_CENTER;

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
      {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} />}
      {shops.map((shop) => {
        const count = counts[shop.id] ?? 0;
        const wait = waitMin[shop.id] ?? 0;
        const availability = shopAvailability(shop);
        return (
          <Marker
            key={shop.id}
            position={[shop.latitude, shop.longitude]}
            icon={pinIcon(count)}
          >
            <Popup>
              <div className="flex w-56 items-center gap-2.5">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl font-display text-sm font-bold text-white"
                  style={
                    shop.logo_url || shop.cover_image_url
                      ? undefined
                      : { background: shopAvatarColor(shop.id) }
                  }
                >
                  {shop.logo_url || shop.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shop.logo_url ?? shop.cover_image_url ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    shopInitial(shop.name)
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-semibold text-ink">{shop.name}</p>
                  <p className="truncate text-xs text-muted">
                    {businessTypeT(shop.business_type)}
                    {shop.address ? ` · ${shop.address}` : ""}
                  </p>
                  <p className="text-xs font-medium text-ink">{t("queueStatus", count, wait)}</p>
                  {/* Same three states the list card shows — a pin that looks
                      bookable but isn't wastes a trip. */}
                  {availability === "NOT_ACCEPTING" && (
                    <p className="text-[11px] font-semibold text-live">{t("notAcceptingPill")}</p>
                  )}
                  {availability === "BREAK" && (
                    <p className="text-[11px] font-semibold text-brass">{t("breakPill")}</p>
                  )}
                  <Link
                    href={`/explore/${shop.id}`}
                    className="inline-block text-xs font-semibold text-accent underline"
                  >
                    {t("viewShop")}
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
