"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import Link from "next/link";
import { ArrowUpRight, Clock3, LocateFixed, MapPin, Minus, Navigation, Plus, ShieldCheck, Star, Users } from "lucide-react";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import type { Shop } from "@/types";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { shopAvailability } from "@/lib/shop-availability";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";
import { mapTiles } from "@/config/map";
import { spreadOverlapping } from "@/lib/geo";

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125]; // Dhaka

/** Brand red, and the two availability tones, as literals the SVG can use. */
/*
 * Pin colours, as CSS variables rather than hex.
 *
 * These end up inside SVG `fill` attributes in a Leaflet `divIcon`, which is
 * still part of the document — so a custom property resolves there exactly as
 * it would anywhere else, and the map follows a theme change along with the
 * rest of the app. Sprint 11's whole point: one attribute on <html>, and
 * nothing is left painted in the old palette.
 *
 * `PIN_FREE` stays the success colour and `PIN_BUSY` the brand, because that
 * is what those two states mean; the theme decides what those colours ARE.
 */
const PIN_ACCENT = "var(--qf-accent-hover)";
const PIN_FREE = "var(--qf-good)";
const PIN_BUSY = "var(--qf-accent)";
const PIN_CLOSED = "var(--qf-muted)";

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
      <div class="ss-locate-halo" style="position:absolute;inset:0;border-radius:50%;background:color-mix(in srgb, var(--qf-accent) 35%, transparent)"></div>
      <div style="position:absolute;top:6px;left:6px;width:14px;height:14px;border-radius:50%;background:var(--qf-accent);border:3px solid var(--qf-card);box-shadow:0 2px 8px rgba(var(--qf-shadow-rgb),.4)"></div>
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
             fill="var(--qf-card)" font-family="system-ui,sans-serif">${initial}</text>`;

  // The count badge is only drawn when there is a queue — an empty shop gets a
  // clean pin rather than a "0" the eye has to read and discard.
  const badge =
    state !== "unavailable" && count > 0
      ? `<g>
           <circle cx="38" cy="9" r="9" fill="${dot}" stroke="var(--qf-card)" stroke-width="2"/>
           <text x="38" y="13" text-anchor="middle" font-size="10" font-weight="800"
                 fill="var(--qf-card)" font-family="system-ui,sans-serif">${count > 9 ? "9+" : count}</text>
         </g>`
      : `<circle cx="38" cy="9" r="6" fill="${dot}" stroke="var(--qf-card)" stroke-width="2"/>`;

  return L.divIcon({
    className: "",
    html: `
      <div class="ss-pin" style="width:48px;height:58px;filter:drop-shadow(0 4px 8px rgba(var(--qf-shadow-rgb),.34))">
        <svg width="48" height="58" viewBox="0 0 48 58" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="ss-pin-clip"><circle cx="23" cy="22" r="15" /></clipPath>
          </defs>
          <path d="M23 1C11.4 1 2 10.4 2 22c0 14.6 21 34 21 34s21-19.4 21-34C44 10.4 34.6 1 23 1z"
                fill="${PIN_ACCENT}" stroke="var(--qf-card)" stroke-width="2.5"/>
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
              "bg-gradient-to-br from-accent to-accent-hover shadow-md ring-4 ring-card/70",
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
    // 288px on a phone so it clears a 320px viewport with room either side,
    // and wider once there is screen to spend — the photo and the name are
    // what make this a preview rather than a tooltip.
    <div className="w-72 overflow-hidden sm:w-80">
      {/* A photo band when the shop has one: it is the fastest way to know
          whether this is the place you meant. */}
      {photo ? (
        <div className="relative h-32 w-full bg-soft">
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

      <div className="p-4">
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
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
              <span className="shrink-0 font-semibold text-accent">
                {businessTypeT(shop.business_type)}
              </span>
              {shop.women_only && (
                <span className="flex shrink-0 items-center gap-0.5 font-semibold text-accent">
                  <ShieldCheck className="h-3 w-3" />
                  {t("womenOnlyBadge")}
                </span>
              )}
            </p>
            {shop.address && (
              <p className="mt-1 flex items-start gap-1 text-[12px] leading-snug text-muted">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                {/* Two lines of a real address, not one truncated fragment.
                    "Afroza Begum Road, Block F" tells you where you are
                    going; "Afroza Begum Road…" does not. */}
                <span className="line-clamp-2">{shop.address}</span>
              </p>
            )}
          </div>

          {rating && rating.review_count > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-brass-soft px-2 py-1 text-[11px] font-bold text-brass">
              <Star className="h-3 w-3 fill-current" />
              <span className="font-number">{rating.avg_rating}</span>
              <span className="font-number font-semibold opacity-70">
                ({rating.review_count})
              </span>
            </span>
          )}
        </div>

        {/* Three chips rather than a grid of bare numbers.
            "০ / মিন" needed reading twice to become "no wait" — an icon and a
            whole phrase say it once. The wait leads and carries the colour,
            because it is the fact that decides whether to set off. */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
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

      <div className="flex gap-2 border-t border-line px-4 py-3.5">
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
      // 16 rather than 15: with one shop the question is "which street is it
      // on", and a step closer answers it without losing the neighbourhood.
      map.setView(points[0], 16, { animate: true });
      return;
    }

    map.fitBounds(points, {
      // Asymmetric on purpose. A popup opens UPWARDS from its pin and the
      // zoom stack sits bottom-right, so equal padding left a popup for a
      // northern pin clipped off the top while wasting space at the bottom.
      // [top, right, bottom, left] is not a thing Leaflet takes, so this is
      // the [y, x] pair plus a nudge: generous vertically for the popup,
      // tighter horizontally so the shops fill the width they are given.
      paddingTopLeft: [28, 88],
      paddingBottomRight: [72, 28],
      // 17 rather than 16: two shops on the same road were being held at a
      // zoom where their pins overlapped, which is exactly when you most want
      // to tell them apart.
      maxZoom: 17,
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
      {/* The basemap now comes from config — see src/config/map.ts for what
          changed and why. Short version: the CARTO style this used to hardcode
          began stamping "KEY REQUIRED" across every tile, so the default is a
          provider that needs no key, and swapping in a paid one is an env var
          rather than an edit here. */}
      <TileLayer
        url={mapTiles.url}
        attribution={mapTiles.attribution}
        maxZoom={mapTiles.maxZoom}
      />

      <FitToShops points={points} signature={signature} />
      <MapControls userLocation={userLocation} />

      {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} />}

      {spreadOverlapping(shops).map((shop) => {
        const count = counts[shop.id] ?? 0;
        const availability = shopAvailability(shop);
        return (
          <Marker
            key={shop.id}
            // The nudged position, so co-located shops are each tappable. The
            // popup below still gets the real row, and its directions link
            // still uses the real coordinates.
            position={[shop.displayLat, shop.displayLng]}
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
