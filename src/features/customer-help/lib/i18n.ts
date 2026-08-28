import type { Dict } from "@/lib/i18n";

export const customerHelpDict = {
  botName: { bn: "সহায়ক", en: "Assistant" },
  botSubtitle: { bn: "SmartSailor-এর AI", en: "SmartSailor's AI" },
  openLabel: { bn: "সাহায্য চাও", en: "Get help" },
  closeLabel: { bn: "বন্ধ করো", en: "Close" },

  greeting: {
    bn: "হ্যালো! সিরিয়াল, বাকি টাকা বা অ্যাপ নিয়ে যা জানার আছে জিজ্ঞেস করো।",
    en: "Hi! Ask me anything about your booking, your dues, or how the app works.",
  },

  suggestion1: { bn: "আমার সিরিয়াল কত দূর?", en: "Where's my place in the queue?" },
  suggestion2: { bn: "সিরিয়াল বাতিল করব কিভাবে?", en: "How do I cancel?" },
  suggestion3: { bn: "আমার কত টাকা বাকি?", en: "How much do I owe?" },
  suggestion4: { bn: "দোকান ডাকলে কী করব?", en: "What if the shop calls me?" },

  placeholder: { bn: "লিখো…", en: "Type a message…" },
  sendLabel: { bn: "পাঠাও", en: "Send" },
  stopLabel: { bn: "থামাও", en: "Stop" },

  // The line that keeps this from being mistaken for the shop.
  notTheShopNote: {
    bn: "এটা AI — দোকানের সাথে কথা বলতে মেসেজ পাতায় যাও।",
    en: "This is AI — to talk to the shop, use Messages.",
  },

  errNoKey: { bn: "সহায়ক এখনো চালু হয়নি।", en: "The assistant isn't switched on yet." },
  errSignedOut: { bn: "আগে লগইন করো।", en: "Please sign in first." },
  errGeneric: { bn: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করো।", en: "Something went wrong. Try again." },
} satisfies Dict;
