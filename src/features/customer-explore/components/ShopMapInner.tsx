"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import type { Shop } from "@/types";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { shopAvailability } from "@/lib/shop-availability";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125]; // Dhaka

/**
 * The blue "you are here" dot, with a soft halo so it reads as a live
 * position rather than another pin.
 */
const userIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:22px;height:22px">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(46,125,214,.22)"></div>
      <div style="position:absolute;top:4px;left:4px;width:14px;height:14px;border-radius:50%;background:#2e7dd6;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(27,24,18,.35)"></div>
    </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/**
 * A shop pin.
 *
 * The queue count lives *inside* the pin rather than on a badge stuck to its
 * corner — the old version's floating black bubble collided with neighbouring
 * pins and read as a separate object. Colour carries availability: green when
 * nobody is waiting, brand red when there's a queue, amber when the shop
 * can't take anyone right now.
 */
function pinIcon(count: number, state: "free" | "busy" | "unavailable") {
  const fill =
    state === "unavailable" ? "#b5852f" : state === "free" ? "#2e7d5b" : "#db4a4a";
  const label = state === "unavailable" ? "—" : String(count);

  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:38px;height:46px;filter:drop-shadow(0 3px 6px rgba(27,24,18,.32))">
        <svg width="38" height="46" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 1C10.16 1 3 8.16 3 17c0 11.5 16 28 16 28s16-16.5 16-28c0-8.84-7.16-16-16-16z" fill="${fill}" stroke="#fff" stroke-width="2.5"/>
        </svg>
        <span style="position:absolute;top:8px;left:0;width:38px;text-align:center;color:#fff;font-size:13px;font-weight:800;font-family:var(--font-number),sans-serif">${label}</span>
      </div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 45],
    popupAnchor: [0, -42],
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
  distanceKm,
  ratingByShopId,
  userLocation,
}: {
  shops: LocatedShop[];
  counts: Record<string, number>;
  waitMin: Record<string, number>;
  distanceKm?: Record<string, number>;
  ratingByShopId?: Map<string, { avg_rating: number; review_count: number }>;
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
      style={{ height: 460, width: "100%" }}
      scrollWheelZoom={false}
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
        const available = availability === "OPEN" || availability === "BREAK";
        const rating = ratingByShopId?.get(shop.id);
        const distance = distanceKm?.[shop.id];
        return (
          <Marker
            key={shop.id}
            position={[shop.latitude, shop.longitude]}
            icon={pinIcon(
              count,
              availability === "NOT_ACCEPTING" || availability === "CLOSED"
                ? "unavailable"
                : count === 0
                  ? "free"
                  : "busy",
            )}
          >
            {/* A business card, not a tooltip: photo, name, rating, the wait,
                the distance, whether they can take you, and one action. */}
            <Popup>
              <div className="w-64 overflow-hidden">
                <div className="flex gap-3 p-3.5">
                  <div
                    className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl font-display text-lg font-extrabold text-white"
                    style={{ background: shopAvatarColor(shop.id) }}
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

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5">
                      <p className="min-w-0 flex-1 truncate font-display text-[15px] leading-tight font-bold text-ink">
                        {shop.name}
                      </p>
                      {rating && rating.review_count > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-brass-soft px-1.5 py-0.5 text-[10px] font-bold text-brass">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          {rating.avg_rating}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {businessTypeT(shop.business_type)}
                      {shop.address ? ` · ${shop.address}` : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          available ? "bg-good-soft text-good" : "bg-live-soft text-live",
                        )}
                      >
                        {available ? t("openBadge") : t("closedBadge")}
                      </span>
                      <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-semibold text-ink">
                        ~<span className="font-number">{wait}</span> {t("minUnit")}
                      </span>
                      {distance != null && (
                        <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-semibold text-ink">
                          <span className="font-number">{distance.toFixed(1)}</span> {t("km")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/explore/${shop.id}`}
                  className="flex items-center justify-center gap-1 border-t border-line bg-soft/60 py-2.5 text-[13px] font-bold text-accent transition-colors hover:bg-soft"
                >
                  {t("viewShop")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
