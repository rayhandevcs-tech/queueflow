import type { Dict } from "@/lib/i18n";

export const customerExploreDict = {
  // FilterSheet
  filterTitle: { bn: "ফিল্টার", en: "Filter" },
  typeLabel: { bn: "ধরন", en: "Type" },
  ratingLabel: { bn: "রেটিং", en: "Rating" },
  all: { bn: "সব", en: "All" },
  distanceLabel: { bn: "দূরত্ব", en: "Distance" },
  withinKm: {
    bn: (km: number) => `${km} কিমি-এর মধ্যে`,
    en: (km: number) => `Within ${km} km`,
  },
  reset: { bn: "রিসেট", en: "Reset" },
  apply: { bn: "প্রয়োগ করো", en: "Apply" },
  closeFilters: { bn: "ফিল্টার বন্ধ করো", en: "Close filters" },

  // SearchFilterBar
  searchPlaceholder: { bn: "দোকান বা সার্ভিস খুঁজো", en: "Search shop or service" },

  // TopRatedSection
  topRatedHeading: { bn: "টপ-রেটেড দোকান", en: "Top-rated shops" },

  // OfferCarousel
  discountOff: {
    bn: (pct: number) => `${pct}% ছাড়`,
    en: (pct: number) => `${pct}% off`,
  },
  shopFallback: { bn: "দোকান", en: "Shop" },

  // LocationPrompt
  locationPromptText: {
    bn: "আশেপাশের দোকান দূরত্ব অনুযায়ী দেখতে লোকেশন দাও",
    en: "Turn on location to see nearby shops by distance",
  },
  locating: { bn: "খোঁজা হচ্ছে…", en: "Locating…" },
  giveLocation: { bn: "লোকেশন দাও", en: "Give location" },
  pickManually: { bn: "ম্যানুয়ালি বেছে নাও", en: "Pick manually" },
  pickLocationOnMap: { bn: "ম্যাপে তোমার লোকেশন বেছে নাও", en: "Pick your location on the map" },

  // ShopList
  noOpenShops: { bn: "এখন কোনো দোকান খোলা নেই", en: "No shops open right now" },
  noOpenShopsDesc: {
    bn: "একটু পরে আবার দেখো, অথবা ম্যাপে আশেপাশের দোকান খুঁজে দেখো।",
    en: "Check again later, or look for nearby shops on the map.",
  },
  runningPrefix: { bn: "চলছে", en: "Running" },
  serialSuffix: { bn: "সিরিয়াল", en: "serial(s)" },
  minWait: { bn: "মিন ওয়েট", en: "min wait" },
  km: { bn: "কিমি", en: "km" },
  notAcceptingPill: { bn: "নতুন সিরিয়াল বন্ধ", en: "Not taking new" },
  breakPill: { bn: "বিরতিতে", en: "On break" },

  // ExploreView
  mapView: { bn: "ম্যাপ", en: "Map" },
  listView: { bn: "লিস্ট", en: "List" },

  // ShopMap
  noShopLocations: { bn: "এখনো কোনো দোকানের লোকেশন সেট করা নেই", en: "No shop locations set yet" },
  noShopLocationsDesc: {
    bn: "লিস্ট ভিউতে গিয়ে খোলা দোকানগুলো দেখো।",
    en: "Switch to list view to see open shops.",
  },

  // ShopMapInner
  queueStatus: {
    bn: (count: number, wait: number) =>
      count === 0 ? "কোনো সিরিয়াল নেই" : `চলছে ${count} সিরিয়াল · ~${wait} মিন ওয়েট`,
    en: (count: number, wait: number) =>
      count === 0 ? "No serial" : `Running ${count} serial · ~${wait} min wait`,
  },
  viewShop: { bn: "দোকান দেখো", en: "View shop" },

  // favorites.api
  notLoggedIn: { bn: "লগইন করা নেই", en: "Not logged in" },

  // use-user-location
  locationUnsupported: { bn: "এই ব্রাউজার লোকেশন সাপোর্ট করে না।", en: "This browser doesn't support location." },
  locationDenied: {
    bn: "লোকেশন পাওয়া যায়নি — ম্যানুয়ালি বেছে নাও।",
    en: "Couldn't get location — pick manually.",
  },

  // explore/page.tsx
  assalamu: { bn: "আসসালামু আলাইকুম 👋", en: "Assalamu Alaikum 👋" },
  nearbySalonsHeading: { bn: "কাছের সেলুন", en: "Nearby salons" },
  openShopsLabel: { bn: "খোলা দোকান", en: "Open shops" },
  minUnit: { bn: "মিন", en: "min" },
  lowestWaitLabel: { bn: "সবচেয়ে কম ওয়েট", en: "Lowest wait" },
  nearbyShopsHeading: { bn: "আশেপাশের দোকান", en: "Nearby shops" },
} satisfies Dict;
