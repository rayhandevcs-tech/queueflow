import type { Dict } from "@/lib/i18n";

export const providerSetupDict = {
  cardTitle: { bn: "ছবি দিয়ে দোকান সাজাও", en: "Set up your shop from photos" },
  cardBody: {
    bn: "দোকানের ২-৩টা ছবি তোলো — সার্ভিসের তালিকা আর দাম নিজে থেকেই তৈরি হয়ে যাবে। আশেপাশের দোকানে আসলে কত নেয়, সেটা দেখেই দাম বসানো হবে।",
    en: "Take two or three photos of your shop and the service list writes itself — priced from what shops around you actually charge.",
  },
  startCta: { bn: "ছবি বাছো", en: "Choose photos" },
  photoCount: {
    bn: (n: number) => `${n}টা ছবি বাছা হয়েছে`,
    en: (n: number) => `${n} photo${n === 1 ? "" : "s"} selected`,
  },
  generateCta: { bn: "তালিকা বানাও", en: "Build my catalogue" },
  generating: { bn: "ছবি দেখছি…", en: "Looking at your photos…" },
  generatingHint: { bn: "২০-৩০ সেকেন্ড লাগতে পারে।", en: "This can take 20-30 seconds." },

  benchmarkNote: {
    bn: (n: number) => `আশেপাশের দোকানের ${n} ধরনের সার্ভিসের আসল দাম দেখে বসানো হয়েছে।`,
    en: (n: number) => `Priced against ${n} service types from nearby shops.`,
  },
  noBenchmarkNote: {
    bn: "আশেপাশে এখনো কোনো দোকানের দাম জানা নেই, তাই দামগুলো শুধু প্রস্তাব — নিজে দেখে ঠিক করে নিও।",
    en: "No nearby prices are known yet, so these are only suggestions — set them yourself.",
  },

  aboutLabel: { bn: "দোকানের পরিচিতি", en: "About the shop" },
  servicesLabel: { bn: "সার্ভিস", en: "Services" },
  rateLabel: { bn: "দাম", en: "Price" },
  durationLabel: { bn: "সময় (মিনিট)", en: "Minutes" },
  removeCta: { bn: "বাদ", en: "Remove" },
  applyCta: { bn: "সব যোগ করো", en: "Add all of this" },
  applying: { bn: "যোগ করছি…", en: "Adding…" },
  discardCta: { bn: "বাতিল", en: "Discard" },
  applied: { bn: "দোকান সাজানো হয়েছে", en: "Your shop is set up" },

  editHint: {
    bn: "যোগ করার আগে যা ইচ্ছে বদলে নাও — যা এখানে দেখছ, ঠিক সেটাই সেভ হবে।",
    en: "Change anything before adding — what you see here is exactly what gets saved.",
  },

  errNoShop: { bn: "আগে দোকানের তথ্য সেভ করো।", en: "Save your shop details first." },
  errTooLarge: { bn: "ছবিগুলো অনেক বড়।", en: "Those photos are too large." },
  errRefused: {
    bn: "এই ছবিগুলো দিয়ে হলো না। দোকানের ভেতরের ছবি দিয়ে চেষ্টা করো।",
    en: "That didn't work with these photos. Try photos of the shop interior.",
  },
  errNoKey: { bn: "এই সুবিধাটা এখনো চালু হয়নি।", en: "This feature isn't switched on yet." },
  errGeneric: { bn: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করো।", en: "Something went wrong. Try again." },

  caveat: {
    bn: "AI-এর প্রস্তাব — দাম আর সার্ভিস তোমার দোকানের, শেষ সিদ্ধান্ত তোমার।",
    en: "AI suggestions — the prices and services are yours, and so is the final say.",
  },
} satisfies Dict;
