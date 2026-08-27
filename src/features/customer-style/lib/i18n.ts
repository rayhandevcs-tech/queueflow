import type { Dict } from "@/lib/i18n";

export const customerStyleDict = {
  pageTitle: { bn: "স্টাইল দেখো", en: "Try a style" },
  pageSubtitle: {
    bn: "নিজের ছবি দিয়ে দেখো কোন স্টাইল তোমার মুখের সাথে মানায়।",
    en: "Use a photo of yourself to see which style suits your face.",
  },

  tabHair: { bn: "চুল", en: "Hair" },
  tabBeard: { bn: "দাড়ি", en: "Beard" },

  // Photo
  uploadTitle: { bn: "একটা ছবি দাও", en: "Add a photo" },
  uploadBody: {
    bn: "সোজা তাকিয়ে তোলা ছবি সবচেয়ে ভালো কাজ করে। ভালো আলোয় তুললে আরও ভালো।",
    en: "A straight-on photo works best. Good light helps.",
  },
  uploadCta: { bn: "ছবি বাছো", en: "Choose a photo" },
  changePhotoCta: { bn: "অন্য ছবি", en: "Change photo" },
  privacyNote: {
    bn: "তোমার ছবি কোথাও জমা রাখা হয় না — শুধু পরামর্শ নেওয়ার সময় পাঠানো হয়, তারপর মুছে যায়।",
    en: "Your photo is never stored — it is sent only to get the advice, then discarded.",
  },

  // Advice
  adviceCta: { bn: "কী মানাবে দেখো", en: "See what suits me" },
  adviceLoading: { bn: "তোমার ছবি দেখছি…", en: "Looking at your photo…" },
  faceReadTitle: { bn: "যা দেখলাম", en: "What I can see" },
  recommendedTitle: { bn: "তোমার জন্য", en: "For you" },
  avoidTitle: { bn: "এটা এড়িয়ে যেতে পারো", en: "Maybe skip this one" },
  confidenceHigh: { bn: "ভালো মানাবে", en: "Strong fit" },
  confidenceMedium: { bn: "মন্দ নয়", en: "Worth a look" },
  allStylesTitle: { bn: "সব স্টাইল", en: "All styles" },

  // Try-on
  tryOnCta: { bn: "বসিয়ে দেখো", en: "Try it on" },
  tryOnTitle: { bn: "বসিয়ে দেখো", en: "Try it on" },
  tryOnHint: {
    bn: "আঙুল দিয়ে টেনে জায়গামতো বসাও, দুই আঙুলে ছোট-বড় করো।",
    en: "Drag it into place; pinch to resize.",
  },
  tryOnNoOverlay: {
    bn: "এই স্টাইলের ছবি এখনো যোগ করা হয়নি — বর্ণনা দেখে বেছে নিতে পারো।",
    en: "No image for this style yet — the description is there to go on.",
  },
  resetCta: { bn: "আবার শুরু", en: "Reset" },
  doneCta: { bn: "হয়েছে", en: "Done" },

  // Sending to the shop
  pickCta: { bn: "এটাই চাই", en: "I want this one" },
  pickedTag: { bn: "✓ দোকানকে জানানো হয়েছে", en: "✓ Sent to the shop" },
  pickNotePlaceholder: {
    bn: "কিছু বলতে চাও? যেমন — একটু ছোট করে",
    en: "Anything to add? e.g. a little shorter",
  },
  pickSaveCta: { bn: "দোকানকে জানাও", en: "Tell the shop" },
  pickSaved: { bn: "দোকানকে জানানো হয়েছে", en: "Sent to the shop" },
  pickClearCta: { bn: "বাদ দাও", en: "Remove" },
  noSerialTitle: { bn: "আগে সিরিয়াল নাও", en: "Book a place first" },
  noSerialBody: {
    bn: "সিরিয়াল নেওয়ার পর পছন্দের স্টাইলটা দোকানকে জানাতে পারবে। এখন শুধু দেখে রাখো।",
    en: "Once you have a booking you can send your choice to the shop. For now, just browse.",
  },

  // Errors
  errRefused: {
    bn: "এই ছবিটা নিয়ে পরামর্শ দেওয়া গেল না। অন্য একটা ছবি দিয়ে দেখো।",
    en: "Couldn't advise on this photo. Try a different one.",
  },
  errNoMatch: {
    bn: "মিল পাওয়া গেল না। সোজা তাকিয়ে তোলা একটা ছবি দিয়ে দেখো।",
    en: "No match found. Try a straight-on photo.",
  },
  errTooLarge: { bn: "ছবিটা অনেক বড়।", en: "That photo is too large." },
  errNoKey: {
    bn: "এই সুবিধাটা এখনো চালু হয়নি।",
    en: "This feature isn't switched on yet.",
  },
  errGeneric: { bn: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করো।", en: "Something went wrong. Try again." },
  retryCta: { bn: "আবার চেষ্টা করো", en: "Try again" },

  aiCaveat: {
    bn: "AI-এর পরামর্শ — শেষ কথা তোমার আর তোমার নাপিতের।",
    en: "AI advice — you and your barber have the final say.",
  },
} satisfies Dict;
