import type { Dict } from "@/lib/i18n";

export const customerExploreDict = {
  // FilterSheet
  filterTitle: { bn: "ফিল্টার", en: "Filter" },
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
  inQueueShort: { bn: "জন আছে", en: "in queue" },
  zoomInAria: { bn: "ম্যাপ বড় করো", en: "Zoom in" },
  zoomOutAria: { bn: "ম্যাপ ছোট করো", en: "Zoom out" },
  recenterAria: { bn: "আমার অবস্থানে যাও", en: "Go to my location" },
  directionsAria: { bn: "পথ দেখাও", en: "Get directions" },
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
  openShopsLabel: { bn: "খোলা দোকান", en: "Open shops" },
  minUnit: { bn: "মিন", en: "min" },
  lowestWaitLabel: { bn: "সবচেয়ে কম ওয়েট", en: "Lowest wait" },
  nearbyShopsHeading: { bn: "আশেপাশের দোকান", en: "Nearby shops" },

  // First-run intro (Sprint 32)
  introTitle: { bn: "কীভাবে কাজ করে", en: "How it works" },
  introStep1Title: { bn: "আশেপাশের দোকান দেখো", en: "Find shops near you" },
  introStep1Body: {
    bn: "কোন দোকানে এখন কতজন আছে আর কত অপেক্ষা, সব লাইভ দেখা যায়।",
    en: "See how many are in each queue right now, and how long the wait is.",
  },
  introStep2Title: { bn: "ফোন থেকেই সিরিয়াল নাও", en: "Take a serial from your phone" },
  introStep2Body: {
    bn: "সার্ভিস বেছে সিরিয়াল নাও — চাইলে সাথের লোকজনের জন্যও একসাথে।",
    en: "Pick your services and book — for the people with you too, if you like.",
  },
  introStep3Title: { bn: "সময় হলে খবর পাবে", en: "We'll tell you when to go" },
  introStep3Body: {
    bn: "দোকানে বসে থাকার দরকার নেই — পালা কাছে এলে কখন রওনা দিতে হবে জানিয়ে দেবো।",
    en: "No sitting around at the shop — we'll tell you when to set out.",
  },
  introStartCta: { bn: "শুরু করি", en: "Let's go" },

  greetingNamed: {
    bn: (name: string) => `আসসালামু আলাইকুম, ${name} 👋`,
    en: (name: string) => `Hello, ${name} 👋`,
  },
  openProfileAria: { bn: "প্রোফাইল খোলো", en: "Open profile" },

  heroHeadline: { bn: "আজ কোথায় বুকিং করবে?", en: "Where are you booking today?" },
  heroSubtitle: {
    bn: "কাছের সেরা দোকানগুলো অপেক্ষা করছে — লাইভ সিরিয়াল দেখে বেছে নাও।",
    en: "The best shops near you are ready — pick one from their live queues.",
  },
  favouriteShopsHeading: { bn: "প্রিয় দোকান", en: "Favourite shops" },
  noFavouritesTitle: { bn: "এখনো কোনো প্রিয় দোকান নেই", en: "No favourites yet" },
  noFavouritesDesc: {
    bn: "পছন্দের দোকানে ♥ চাপলে এখানে জমা থাকবে — পরে এক ট্যাপেই পৌঁছে যাবে।",
    en: "Tap ♥ on a shop you like and it'll live here for one-tap access.",
  },

  openBadge: { bn: "খোলা", en: "Open" },
  closedBadge: { bn: "নিচ্ছে না", en: "Not taking" },

  retryLocation: { bn: "আবার চেষ্টা করো", en: "Try again" },
  dismissLocationAria: { bn: "বন্ধ করো", en: "Dismiss" },

  reviewsCount: {
    bn: (n: number) => `${n} রিভিউ`,
    en: (n: number) => `${n} reviews`,
  },
} satisfies Dict;