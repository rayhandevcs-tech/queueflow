/**
 * The basemap the customer's shop map draws on.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * The tile URL used to be a literal in `ShopMapInner`, pointing at CARTO's
 * `basemaps.cartocdn.com/rastertiles/voyager_nolabels`. That endpoint stopped
 * serving anonymous traffic: it still returns images, but every tile now has
 * **"KEY REQUIRED" stamped diagonally across it**. So the map did not break in
 * a way that throws — it broke in the way that is worst, by continuing to
 * render while looking like a pirated copy of itself.
 *
 * Moving it here does two things. The default needs no key and no account, so
 * the map works on a fresh clone and in a demo. And the URL is now one
 * environment variable, so a paid provider can be dropped in without touching
 * a component.
 *
 * ---------------------------------------------------------------------------
 * What was lost, honestly
 * ---------------------------------------------------------------------------
 * The old style was chosen label-free on purpose, and that reasoning still
 * holds: OSM's place names around Dhaka are Bengali, raster tiles bake them in
 * at a size and weight picked for Latin script, and the conjuncts and matras
 * come out mangled — which reads as a bug in our app rather than in the tiles.
 *
 * There is no no-key, label-free raster basemap to switch to. So the default
 * below is standard OSM, labels and all. That is a deliberate trade: slightly
 * awkward Bengali labels are a cosmetic annoyance, whereas "KEY REQUIRED"
 * across the whole map is a credibility problem. If you want the label-free
 * look back, get a key from CARTO or Stadia and set the two variables below —
 * nothing else has to change.
 */

/**
 * OSM's public tile server. Free, no key, no account — and correspondingly
 * rate-limited, so it suits a demo and early users rather than scale. Its
 * usage policy requires the attribution below and forbids heavy bulk use;
 * both are reasons to move to a paid provider once there is traffic.
 */
const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION = "&copy; OpenStreetMap contributors";

export const mapTiles = {
  /**
   * Set `NEXT_PUBLIC_MAP_TILE_URL` to a provider of your own — e.g. a CARTO or
   * Stadia style with your key already in the query string. `{z}/{x}/{y}` and
   * the optional `{r}` (retina) placeholders are substituted by Leaflet.
   *
   * `NEXT_PUBLIC_` because the browser is what fetches the tiles; there is no
   * way to keep a raster tile URL server-side, which is also why a tile key is
   * a rate-limit credential and must never be a billing-sensitive secret.
   */
  url: process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL,

  /** Providers require their own credit; keep this in step with the URL. */
  attribution: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || DEFAULT_ATTRIBUTION,

  /**
   * OSM's raster tiles stop at 19. Asking Leaflet for 20 against a server that
   * has no 20 gives grey squares at the deepest zoom, so the ceiling belongs
   * with the URL rather than in the component.
   */
  maxZoom: Number(process.env.NEXT_PUBLIC_MAP_TILE_MAX_ZOOM) || 19,
} as const;
