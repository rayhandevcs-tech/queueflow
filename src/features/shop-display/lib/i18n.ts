import type { Dict } from "@/lib/i18n";

export const shopDisplayDict = {
  nowServing: { bn: "এখন চলছে", en: "Now serving" },
  nextUp: { bn: "পরবর্তী", en: "Next" },
  freeNow: { bn: "খালি", en: "Free" },
  noneWaiting: { bn: "—", en: "—" },
  waitingCount: {
    bn: (n: number) => `${n} জন অপেক্ষায়`,
    en: (n: number) => `${n} waiting`,
  },
  estWait: { bn: "আনুমানিক অপেক্ষা", en: "Estimated wait" },
  minutes: { bn: "মিনিট", en: "min" },
  ctaHeadline: { bn: "লাইনে দাঁড়ানোর দরকার নেই", en: "No need to stand in line" },
  ctaBody: {
    bn: "ফোনে সিরিয়াল নাও — কখন আসতে হবে জানিয়ে দেবো",
    en: "Take a serial on your phone — we'll tell you when to come",
  },
  shopClosed: { bn: "দোকান এখন বন্ধ", en: "The shop is closed" },
  notAccepting: {
    bn: "নতুন সিরিয়াল নেওয়া বন্ধ — চলমান কিউ শেষ করা হচ্ছে",
    en: "Not taking new serials — finishing the current queue",
  },
  onBreak: {
    bn: (n: number) => `বিরতি চলছে — আর প্রায় ${n} মিনিট`,
    en: (n: number) => `On a break — about ${n} more minutes`,
  },
  notFoundTitle: { bn: "দোকান পাওয়া যায়নি", en: "Shop not found" },
  notFoundBody: {
    bn: "লিংকটা ঠিক আছে কিনা দেখো — অথবা দোকানটি এখনো অনুমোদিত হয়নি।",
    en: "Check the link — or the shop may not be approved yet.",
  },
  connectionLost: { bn: "সংযোগ নেই — আবার চেষ্টা চলছে", en: "Offline — retrying" },
} satisfies Dict;
