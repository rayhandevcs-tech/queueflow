// src/config/site.ts
export const site = {
  name: "SmartSailor",
  tagline: "No more waiting at the salon — your serial, in your pocket",
  /**
   * Absolute-URL base for metadata, and the fallback origin when something is
   * generated outside the browser. Anything running client-side prefers
   * `window.location.origin`, so this only matters for server rendering.
   */
  url: "https://smartsailor.app",
  supportEmail: "support@smartsailor.app",
} as const;
