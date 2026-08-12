"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  LocateFixed,
  Minus,
  Navigation,
  Plus,
  Star,
  Users,
} from "lucide-react";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import type { Shop } from "@/types";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { shopAvailability } from "@/lib/shop-availability";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125]; // Dhaka

/** Brand red, and the two availability tones, as literals the SVG can use. */
const PIN_ACCENT = "#b8323c";
const PIN_FREE = "#2e7d5b";
const PIN_BUSY = "#db4a4a";
const PIN_CLOSED = "#8b8178";

/**
 * "You are here."
 *
 * A breathing halo under a solid dot, in a blue that appears nowhere else on
 * the map — the shop pins are all brand red and availability green/amber, so
 * hue alone separates "me" from "a place". The halo animation lives in
 * globals.css because Leaflet builds this markup as an HTML string, outside
 * React's className pipeline.
 */
const userIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:26px;height:26px">
      <div class="ss-locate-halo" style="position:absolute;inset:0;border-radius:50%;background:rgba(46,125,214,.35)"></div>
      <div style="position:absolute;top:6px;left:6px;width:14px;height:14px;border-radius:50%;background:#2e7dd6;border:3px solid #fff;box-shadow:0 2px 8px rgba(27,24,18,.4)"></div>
    </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/**
 * A shop pin: the shop's own photo (or its initial) held inside a teardrop.
 *
 * The previous pin was a plain coloured drop with the queue count printed on
 * it — legible, but every shop looked identical from a distance, so the map
 * read as a scatter of dots rather than a set of places. Identity now carries
 * the pin (photo first), availability rides on a small dot at the shoulder,
 * and the queue count sits in a badge beside it. Nothing was dropped; the
 * three facts are just no longer competing for the same 38 pixels.
 */
function shopPinIcon({
  photoUrl,
  initial,
  fallbackColor,
  count,
  state,
}: {
  photoUrl: string | null;
  initial: string;
  fallbackColor: string;
  count: number;
  state: "free" | "busy" | "unavailable";
}) {
  const dot = state === "unavailable" ? PIN_CLOSED : state === "free" ? PIN_FREE : PIN_BUSY;

  const inner = photoUrl
    ? `<image href="${photoUrl}" x="8" y="7" width="30" height="30" clip-path="url(#ss-pin-clip)" preserveAspectRatio="xMidYMid slice" />`
    : `<circle cx="23" cy="22" r="15" fill="${fallbackColor}" />
       <text x="23" y="28" text-anchor="middle" font-size="16" font-weight="800"
             fill="#fff" font-family="system-ui,sans-serif">${initial}</text>`;

  // The count badge is only drawn when there is a queue — an empty shop gets a
  // clean pin rather than a "0" the eye has to read and discard.
  const badge =
    state !== "unavailable" && count > 0
      ? `<g>
           <circle cx="38" cy="9" r="9" fill="${dot}" stroke="#fff" stroke-width="2"/>
           <text x="38" y="13" text-anchor="middle" font-size="10" font-weight="800"
                 fill="#fff" font-family="system-ui,sans-serif">${count > 9 ? "9+" : count}</text>
         </g>`
      : `<circle cx="38" cy="9" r="6" fill="${dot}" stroke="#fff" stroke-width="2"/>`;

  return L.divIcon({
    className: "",
    html: `
      <div class="ss-pin" style="width:48px;height:58px;filter:drop-shadow(0 4px 8px rgba(27,24,18,.34))">
        <svg width="48" height="58" viewBox="0 0 48 58" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="ss-pin-clip"><circle cx="23" cy="22" r="15" /></clipPath>
          </defs>
          <path d="M23 1C11.4 1 2 10.4 2 22c0 14.6 21 34 21 34s21-19.4 21-34C44 10.4 34.6 1 23 1z"
                fill="${PIN_ACCENT}" stroke="#fff" stroke-width="2.5"/>
          ${inner}
          ${badge}
        </svg>
      </div>`,
    iconSize: [48, 58],
    iconAnchor: [23, 56],
    popupAnchor: [0, -52],
  });
}

/**
 * Zoom and recenter, stacked in one column.
 *
 * Leaflet's own zoom control is disabled in favour of this: the library places
 * it top-left, away from the thumb on a phone, and it can't sit in the same
 * stack as a locate button. One column bottom-right keeps every map action in
 * one reachable place.
 */
function MapControls({ userLocation }: { userLocation?: { lat: number; lng: number } | null }) {
  const map = useMap();
  const t = useT(customerExploreDict);
  const stackRef = useRef<HTMLDivElement>(null);

  // Without this, a press on a button also reaches the map underneath: the
  // click starts a drag and a double-tap on "+" zooms twice. Leaflet's own
  // controls get this treatment from the library; ours has to ask for it.
  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  const buttonClass = cn(
    "grid h-11 w-11 place-items-center bg-card text-ink",
    "transition-colors duration-150 hover:bg-soft hover:text-accent",
    "focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:outline-none",
  );

  return (
    // z-[1000] clears Leaflet's tile and marker panes; the outer layer stays
    // click-through so only the buttons themselves capture input.
    <div className="pointer-events-none absolute inset-0 z-[1000]">
      <div
        ref={stackRef}
        className="pointer-events-auto absolute right-3 bottom-6 flex flex-col items-end gap-2.5"
      >
        <div className="flex flex-col overflow-hidden rounded-2xl border border-line shadow-md">
          <button
            type="button"
            aria-label={t("zoomInAria")}
            onClick={() => map.zoomIn()}
            className={cn(buttonClass, "border-b border-line")}
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            aria-label={t("zoomOutAria")}
            onClick={() => map.zoomOut()}
            className={buttonClass}
          >
            <Minus className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Brand-coloured and round, because it is the one control that does
            something rather than adjusting the view. Hidden entirely when
            there is no location to fly to — a dead button is worse than none. */}
        {userLocation && (
          <button
            type="button"
            aria-label={t("recenterAria")}
            title={t("recenterAria")}
            onClick={() => map.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 0.8 })}
            className={cn(
              "grid h-13 w-13 place-items-center rounded-full text-accent-ink",
              "bg-gradient-to-br from-accent to-[#c03d47] shadow-md ring-4 ring-card/70",
              "transition-[box-shadow,transform] duration-150 hover:shadow-glow active:scale-95",
              "focus-visible:ring-4 focus-visible:ring-accent/40 focus-visible:outline-none",
            )}
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

interface LocatedShop extends Shop {
  latitude: number;
  longitude: number;
}

/** The popup card, lifted out so the marker loop stays readable. */
function ShopPopupCard({
  shop,
  count,
  wait,
  distance,
  rating,
}: {
  shop: LocatedShop;
  count: number;
  wait: number;
  distance?: number;
  rating?: { avg_rating: number; review_count: number };
}) {
  const t = useT(customerExploreDict);
  const businessTypeT = useT(BUSINESS_TYPE_LABEL);
  const availability = shopAvailability(shop);
  const available = availability === "OPEN" || availability === "BREAK";
  const photo = shop.cover_image_url ?? shop.logo_url;

  return (
    <div className="w-72 overflow-hidden">
      {/* A photo band when the shop has one: it is the fastest way to know
          whether this is the place you meant. */}
      {photo ? (
        <div className="relative h-28 w-full bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-ink/55 to-transparent" />
          <span
            className={cn(
              "absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm",
              available ? "bg-good-soft/90 text-good" : "bg-live-soft/90 text-live",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                available ? "animate-pulse-live bg-good" : "bg-live",
              )}
            />
            {available ? t("openBadge") : t("closedBadge")}
          </span>
        </div>
      ) : null}

      <div className="p-3.5">
        <div className="flex items-start gap-3">
          {!photo && (
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-extrabold text-white"
              style={{ background: shopAvatarColor(shop.id) }}
            >
              {shopInitial(shop.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[16px] leading-tight font-bold text-ink">
              {shop.name}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-muted">
              {businessTypeT(shop.business_type)}
              {shop.address ? ` · ${shop.address.split(",")[0].trim()}` : ""}
            </p>
          </div>

          {rating && rating.review_count > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-brass-soft px-2 py-1 text-[11px] font-bold text-brass">
              <Star className="h-3 w-3 fill-current" />
              <span className="font-number">{rating.avg_rating}</span>
            </span>
          )}
        </div>

        {/* Three chips rather than a grid of bare numbers.
            "০ / মিন" needed reading twice to become "no wait" — an icon and a
            whole phrase say it once. The wait leads and carries the colour,
            because it is the fact that decides whether to set off. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
              count === 0 ? "bg-good-soft text-good" : "bg-live-soft text-live",
            )}
          >
            <Clock3 className="h-3 w-3" />
            {count === 0 ? t("walkInNow") : t("waitMinutes", wait)}
          </span>

          {count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-[11px] font-medium text-muted">
              <Users className="h-3 w-3" />
              {t("inQueue", count)}
            </span>
          )}

          {distance != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-[11px] font-medium text-muted">
              <Navigation className="h-3 w-3" />
              <span className="font-number text-ink">{distance.toFixed(1)}</span>
              {t("km")}
            </span>
          )}
        </div>

        {!photo && (
          <span
            className={cn(
              "mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
              available ? "bg-good-soft text-good" : "bg-live-soft text-live",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                available ? "animate-pulse-live bg-good" : "bg-live",
              )}
            />
            {available ? t("openBadge") : t("closedBadge")}
          </span>
        )}
      </div>

      <div className="flex gap-2 border-t border-line px-3.5 py-3">
        <Link
          href={`/explore/${shop.id}`}
          // The colours live in globals.css under .ss-map-cta, not here:
          // Leaflet's own `.leaflet-container a` rule is more specific than a
          // Tailwind colour utility, so bg-/text- classes on this element were
          // silently ignored and the label came out the library's blue-green.
          className={cn(
            "ss-map-cta flex min-h-10 flex-1 items-center justify-center gap-1.5",
            "rounded-[14px] text-[13px] font-bold shadow-sm transition-shadow active:shadow-xs",
          )}
        >
          {t("viewShop")}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
          target="_blank"
          rel="noreferrer"
          aria-label={t("directionsAria")}
          title={t("directionsAria")}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-line bg-card text-muted",
            "transition-colors hover:border-accent/40 hover:text-accent",
          )}
        >
          <Navigation className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

/**
 * Frames every nearby shop, plus you, on first paint and whenever the set
 * changes.
 *
 * The map used to open at a fixed zoom centred on one point, so a shop 16 km
 * away simply wasn't on screen — the whole "nearby shops" map showed an empty
 * neighbourhood. fitBounds asks the opposite question: what view contains
 * everything worth seeing?
 *
 * Keyed on the shop ids and the user's coordinates, not on the objects: a
 * refetch that returns the same shops must not yank the view back from
 * wherever the person has panned to.
 */
function FitToShops({
  points,
  signature,
}: {
  points: Array<[number, number]>;
  signature: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
      return;
    }

    map.fitBounds(points, {
      // Room for the popup and the control stack, and a ceiling so two shops
      // in the same street don't zoom to rooftops.
      padding: [48, 48],
      maxZoom: 16,
      animate: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);

  return null;
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
  const points: Array<[number, number]> = shops.map((s) => [s.latitude, s.longitude]);
  if (userLocation) points.push([userLocation.lat, userLocation.lng]);

  const center: [number, number] = points[0] ?? DEFAULT_CENTER;
  const signature = [
    shops.map((s) => s.id).join(","),
    userLocation ? `${userLocation.lat},${userLocation.lng}` : "",
  ].join("|");

  return (
    <MapContainer
      center={center}
      zoom={14}
      // Our own stack, bottom-right — see MapControls.
      zoomControl={false}
      className="h-[26rem] w-full sm:h-[30rem]"
      scrollWheelZoom={false}
    >
      {/* Voyager, label-free.
          OSM's place names around Dhaka are Bengali, and the raster tiles bake
          them in at a size and weight chosen for Latin script — conjuncts and
          matras came out broken and unreadable, which looked like a rendering
          fault in our app. There is no per-language raster to switch to, so
          the labels go: the basemap becomes roads, water and parks, and the
          only text on the map is ours, on the pins. */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        maxZoom={20}
      />

      <FitToShops points={points} signature={signature} />
      <MapControls userLocation={userLocation} />

      {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} />}

      {shops.map((shop) => {
        const count = counts[shop.id] ?? 0;
        const availability = shopAvailability(shop);
        return (
          <Marker
            key={shop.id}
            position={[shop.latitude, shop.longitude]}
            icon={shopPinIcon({
              photoUrl: shop.logo_url ?? shop.cover_image_url ?? null,
              initial: shopInitial(shop.name),
              fallbackColor: shopAvatarColor(shop.id),
              count,
              state:
                availability === "NOT_ACCEPTING" || availability === "CLOSED"
                  ? "unavailable"
                  : count === 0
                    ? "free"
                    : "busy",
            })}
          >
            <Popup>
              <ShopPopupCard
                shop={shop}
                count={count}
                wait={waitMin[shop.id] ?? 0}
                distance={distanceKm?.[shop.id]}
                rating={ratingByShopId?.get(shop.id)}
              />
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
