import type { Dict } from "@/lib/i18n";

export const customerHelpDict = {
  botName: { bn: "সহায়ক", en: "Assistant" },
  botSubtitle: { bn: "SmartSailor-এর AI", en: "SmartSailor's AI" },
  openLabel: { bn: "সাহায্য চাও", en: "Get help" },
  closeLabel: { bn: "বন্ধ করো", en: "Close" },

  greeting: {
    bn: "হ্যালো! দোকান খুঁজতে, সার্ভিসের দাম বা লাইনে কত সময় লাগবে জানতে — অথবা অ্যাপ নিয়ে যেকোনো প্রশ্ন করতে পারো।",
    en: "Hi! Ask me to find a shop, check a price or a wait time — or anything about how the app works.",
  },

  // Two discovery prompts and two help prompts: the assistant now does both,
  // and the chips are how a customer finds out it can search at all.
  suggestion1: { bn: "কোন সেলুনে লাইন কম?", en: "Which salon has a shorter queue?" },
  suggestion2: { bn: "১৫০০ টাকার মধ্যে ফেসিয়াল", en: "Facial under ৳1500" },
  suggestion3: { bn: "গতবার কী করিয়েছিলাম?", en: "What did I get last time?" },
  suggestion4: { bn: "সিরিয়াল বাতিল করব কিভাবে?", en: "How do I cancel?" },

  placeholder: { bn: "লিখো…", en: "Type a message…" },
  sendLabel: { bn: "পাঠাও", en: "Send" },
  stopLabel: { bn: "থামাও", en: "Stop" },

  // Voice. Bangla on a phone keyboard is slow and the person is usually
  // mid-shift with one hand free, so speaking is the faster input here.
  micLabel: { bn: "বলে বলো", en: "Speak" },
  micStopLabel: { bn: "বলা শেষ", en: "Done speaking" },
  micHint: { bn: "শুনছি… বলো", en: "Listening… go ahead" },
  micDenied: {
    bn: "মাইকের অনুমতি দেওয়া হয়নি। ব্রাউজারের সেটিংস থেকে অনুমতি দাও।",
    en: "Microphone permission was refused. Allow it in your browser settings.",
  },
  listenLabel: { bn: "শুনি", en: "Listen" },
  listenStopLabel: { bn: "থামাও", en: "Stop" },

  // The line that keeps this from being mistaken for the shop.
  notTheShopNote: {
    bn: "এটা AI — দোকানের সাথে কথা বলতে মেসেজ পাতায় যাও।",
    en: "This is AI — to talk to the shop, use Messages.",
  },

  errNoKey: { bn: "সহায়ক এখনো চালু হয়নি।", en: "The assistant isn't switched on yet." },
  errSignedOut: { bn: "আগে লগইন করো।", en: "Please sign in first." },
  errGeneric: { bn: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করো।", en: "Something went wrong. Try again." },
} satisfies Dict;
